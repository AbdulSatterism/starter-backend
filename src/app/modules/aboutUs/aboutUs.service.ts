import { TAbout } from './aboutUs.interface';
import { About } from './aboutUs.model';
import { redisStore } from '../../../shared/redis';

const ABOUT_CACHE_KEY = 'content:about';
const ABOUT_CACHE_TAG = 'content:about';

const createAbout = async (payload: TAbout) => {
  const result = await About.create(payload);

  await redisStore.invalidateTag(ABOUT_CACHE_TAG);

  return result;
};

const getAllAbouts = async () => {
  const cached = await redisStore.get<TAbout[]>(ABOUT_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const result = await About.find().lean();

  await redisStore.set(ABOUT_CACHE_KEY, result, 300, [ABOUT_CACHE_TAG]);

  return result;
};

const updateAbout = async (payload: TAbout) => {
  const result = await About.findOneAndUpdate(
    {},
    { description: payload.description },
    { new: true },
  );

  await redisStore.invalidateTag(ABOUT_CACHE_TAG);

  return result;
};

export const aboutServices = {
  createAbout,
  updateAbout,
  getAllAbouts,
};
