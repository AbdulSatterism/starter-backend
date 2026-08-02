import { TPrivacy } from './privacy.interface';
import { Privacy } from './privacy.model';
import { redisStore } from '../../../shared/redis';

const PRIVACY_CACHE_KEY = 'content:privacy';
const PRIVACY_CACHE_TAG = 'content:privacy';

const createPrivacy = async (payload: TPrivacy) => {
  const result = await Privacy.create(payload);

  await redisStore.invalidateTag(PRIVACY_CACHE_TAG);

  return result;
};

const getAllPrivacy = async () => {
  const cached = await redisStore.get<TPrivacy[]>(PRIVACY_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const result = await Privacy.find().lean();

  await redisStore.set(PRIVACY_CACHE_KEY, result, 300, [PRIVACY_CACHE_TAG]);

  return result;
};

const updatePrivacy = async (payload: TPrivacy) => {
  const result = await Privacy.findOneAndUpdate(
    {},
    { description: payload.description },
    { new: true },
  );

  await redisStore.invalidateTag(PRIVACY_CACHE_TAG);

  return result;
};

export const privacyServices = {
  createPrivacy,
  updatePrivacy,
  getAllPrivacy,
};
