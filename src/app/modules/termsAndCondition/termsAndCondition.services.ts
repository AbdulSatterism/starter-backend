import { TTermsCondition } from './termsAndCondition.interface';
import { TermsCondition } from './termsAndCondition.model';
import { redisStore } from '../../../shared/redis';

const TERMS_CACHE_KEY = 'content:terms';
const TERMS_CACHE_TAG = 'content:terms';

const createTermsCondition = async (payload: TTermsCondition) => {
  const result = await TermsCondition.create(payload);

  await redisStore.invalidateTag(TERMS_CACHE_TAG);

  return result;
};

const getTermsCondinton = async () => {
  const cached = await redisStore.get<TTermsCondition[]>(TERMS_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const result = await TermsCondition.find().lean();

  await redisStore.set(TERMS_CACHE_KEY, result, 300, [TERMS_CACHE_TAG]);

  return result;
};

const updateTermsCondition = async (payload: TTermsCondition) => {
  const result = await TermsCondition.findOneAndUpdate(
    {},
    { description: payload.description },
    { new: true },
  );

  await redisStore.invalidateTag(TERMS_CACHE_TAG);

  return result;
};

export const termsConditionServices = {
  createTermsCondition,
  updateTermsCondition,
  getTermsCondinton,
};
