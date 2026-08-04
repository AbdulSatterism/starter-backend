/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { USER_ROLES } from '../../../enums/user';
import { emailHelper } from '../../../helpers/emailHelper';
import { sendOtpSms } from '../../../helpers/smsHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import { redisStore } from '../../../shared/redis';
import generateOTP from '../../../util/generateOTP';

import { IUser } from './user.interface';
import { User } from './user.model';
import unlinkFile from '../../../shared/unlinkFile';
import AppError from '../../errors/AppError';

const USER_PROFILE_TTL = 300;
const USER_LIST_TTL = 60;
const USER_STATS_TTL = 60;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const invalidateUserCaches = async (userId?: string) => {
  await Promise.all([
    redisStore.invalidateTag('users:list'),
    redisStore.invalidateTag('users:stats'),
    userId ? redisStore.invalidateTag(`user:${userId}`) : Promise.resolve(),
  ]);
};

const createUserFromDb = async (payload: IUser) => {
  payload.role = USER_ROLES.USER;
  const result = await User.create(payload);

  if (!result) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to create user');
  }

  const otp = generateOTP();
  const emailValues = {
    name: result.name || 'User',
    otp,
    email: result.email,
  };

  const accountEmailTemplate = emailTemplate.createAccount(emailValues);
  emailHelper.sendEmail(accountEmailTemplate);

  // Update user with authentication details
  const authentication = {
    oneTimeCode: otp,
    expireAt: new Date(Date.now() + 20 * 60000),
  };
  const updatedUser = await User.findOneAndUpdate(
    { _id: result._id },
    { $set: { authentication } },
  );
  if (!updatedUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found for update');
  }

  await Promise.all([
    redisStore.setOtp(
      `verify:${result.email}`,
      { otp, userId: result._id.toString() },
      20 * 60,
    ),
    result.phone
      ? sendOtpSms({
          to: result.phone,
          name: result.name || 'User',
          otp,
          type: 'VERIFY',
        })
      : Promise.resolve(),
  ]);

  await invalidateUserCaches(result._id.toString());

  return result;
};

const getAllUsers = async (query: Record<string, unknown>) => {
  const { page, limit } = query;
  const pages = parseInt(page as string) || 1;
  const size = parseInt(limit as string) || 10;
  const skip = (pages - 1) * size;
  const cacheKey = `users:list:${pages}:${size}`;

  const cached = await redisStore.get<{
    data: IUser[];
    meta: { page: number; limit: number; totalPage: number; total: number };
  }>(cacheKey);

  if (cached) {
    return cached;
  }

  const [result, total] = await Promise.all([
    User.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .select('-password -authentication')
      .lean(),
    User.countDocuments({ isDeleted: { $ne: true } }),
  ]);

  const totalPage = Math.ceil(total / size);

  const response = {
    data: result,
    meta: {
      page: pages,
      limit: size,
      totalPage,
      total,
    },
  };

  await redisStore.set(cacheKey, response, USER_LIST_TTL, ['users:list']);

  return response;
};

const getUserProfileFromDB = async (
  user: JwtPayload,
): Promise<Partial<IUser>> => {
  const { id } = user;
  const cacheKey = `user:profile:${id}`;
  const cached = await redisStore.get<Partial<IUser>>(cacheKey);

  if (cached) {
    return cached;
  }

  const isExistUser = await User.findById(id).select(
    '-password -authentication',
  );
  if (!isExistUser) {
    throw new AppError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const profile = isExistUser.toObject();
  await redisStore.set(cacheKey, profile, USER_PROFILE_TTL, [`user:${id}`]);

  return profile;
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Partial<IUser>,
): Promise<Partial<IUser | null>> => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);

  if (!isExistUser) {
    throw new AppError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  if (!isExistUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Blog not found');
  }

  if (!isExistUser.verified) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Please verify your account first',
    );
  }

  if (payload.image && isExistUser.image) {
    unlinkFile(isExistUser.image);
  }

  const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  });

  await invalidateUserCaches(id as string);

  return updateDoc;
};

const getSingleUser = async (id: string): Promise<IUser | null> => {
  const cacheKey = `user:single:${id}`;
  const cached = await redisStore.get<IUser>(cacheKey);

  if (cached) {
    return cached;
  }

  const result = await User.findById(id)
    .select('-password -authentication')
    .lean();
  if (!result) {
    return null;
  }

  await redisStore.set(cacheKey, result, USER_PROFILE_TTL, [`user:${id}`]);

  return result;
};

const searchUserByPhone = async (
  searchTerm: string,
  userId: string,
  query: Record<string, unknown> = {},
) => {
  const pages = parseInt(query.page as string) || 1;
  const size = parseInt(query.limit as string) || 10;
  const skip = (pages - 1) * size;
  const normalizedSearchTerm = searchTerm?.trim() || '';
  const cacheKey = `users:search:${normalizedSearchTerm || 'all'}:${pages}:${size}:${userId}`;

  const cached = await redisStore.get<{
    data: IUser[];
    meta: { page: number; limit: number; totalPage: number; total: number };
  }>(cacheKey);

  if (cached) {
    return cached;
  }

  const baseQuery: Record<string, any> = {
    _id: { $ne: userId },
    isDeleted: { $ne: true },
  };

  let mongoQuery: Record<string, any> = baseQuery;
  let sort: Record<string, any> = { createdAt: -1 };
  let projection = '-password -authentication';

  if (normalizedSearchTerm) {
    if (/^[0-9+\-()\s]+$/.test(normalizedSearchTerm)) {
      mongoQuery = {
        ...baseQuery,
        phone: { $regex: `^${escapeRegex(normalizedSearchTerm)}` },
      };
    } else {
      mongoQuery = {
        ...baseQuery,
        $text: { $search: normalizedSearchTerm },
      };
      projection = '-password -authentication score';
      sort = { score: { $meta: 'textScore' }, createdAt: -1 };
    }
  }

  const [result, total] = await Promise.all([
    User.find(mongoQuery)
      .select(projection)
      .sort(sort)
      .skip(skip)
      .limit(size)
      .lean(),
    User.countDocuments(mongoQuery),
  ]);

  const response = {
    data: result,
    meta: {
      page: pages,
      limit: size,
      totalPage: Math.ceil(total / size),
      total,
    },
  };

  await redisStore.set(cacheKey, response, USER_LIST_TTL, ['users:list']);

  return response;
};

const getUsersBatch = async (ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean).slice(0, 100);

  if (uniqueIds.length === 0) {
    return [];
  }

  const result = await User.find({
    _id: { $in: uniqueIds },
    isDeleted: { $ne: true },
  })
    .select('-password -authentication')
    .lean();

  return uniqueIds
    .map(id => result.find(user => user._id.toString() === id))
    .filter(Boolean);
};

const getUserStats = async () => {
  const cacheKey = 'users:stats';
  const cached = await redisStore.get<Record<string, unknown>>(cacheKey);

  if (cached) {
    return cached;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, verified, admins, users, newThisMonth] = await Promise.all([
    User.countDocuments({ isDeleted: { $ne: true } }),
    User.countDocuments({ isDeleted: { $ne: true }, verified: true }),
    User.countDocuments({ isDeleted: { $ne: true }, role: USER_ROLES.ADMIN }),
    User.countDocuments({ isDeleted: { $ne: true }, role: USER_ROLES.USER }),
    User.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: startOfMonth },
    }),
  ]);

  const response = {
    total,
    verified,
    admins,
    users,
    newThisMonth,
  };

  await redisStore.set(cacheKey, response, USER_STATS_TTL, ['users:stats']);

  return response;
};

export const UserService = {
  createUserFromDb,
  getUserProfileFromDB,
  updateProfileToDB,
  getSingleUser,
  searchUserByPhone,
  getAllUsers,
  getUsersBatch,
  getUserStats,
};
