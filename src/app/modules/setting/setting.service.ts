import { TSetting } from './setting.interface';
import { Setting } from './setting.model';
import { redisStore } from '../../../shared/redis';

const SETTING_CACHE_KEY = 'content:setting';
const SETTING_CACHE_TAG = 'content:setting';

const createSetting = async (payload: TSetting) => {
  const result = await Setting.create(payload);

  await redisStore.invalidateTag(SETTING_CACHE_TAG);

  return result;
};

const getAllSetting = async () => {
  const cached = await redisStore.get<TSetting[]>(SETTING_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const result = await Setting.find().lean();

  await redisStore.set(SETTING_CACHE_KEY, result, 300, [SETTING_CACHE_TAG]);

  return result;
};

const updateSetting = async (payload: TSetting) => {
  const result = await Setting.findOneAndUpdate(
    {},
    { description: payload.description },
    { new: true },
  );

  await redisStore.invalidateTag(SETTING_CACHE_TAG);

  return result;
};

export const settingServices = {
  createSetting,
  updateSetting,
  getAllSetting,
};
