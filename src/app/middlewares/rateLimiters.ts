import { NextFunction, Request, Response } from 'express';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { redisStore } from '../../shared/redis';

type RateLimiterConfig = {
  points: number;
  duration: number;
  keyPrefix: string;
  blockDuration?: number;
  keyGenerator?: (req: Request) => string;
};

const createLimiter = ({
  points,
  duration,
  keyPrefix,
  blockDuration = 0,
  keyGenerator = req => req.ip || req.clientIp || '127.0.0.1',
}: RateLimiterConfig) => {
  const limiter = redisStore.client
    ? new RateLimiterRedis({
        storeClient: redisStore.client,
        keyPrefix,
        points,
        duration,
        blockDuration,
      })
    : new RateLimiterMemory({
        keyPrefix,
        points,
        duration,
        blockDuration,
      });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const rateResult = await limiter.consume(key);

      res.setHeader('X-RateLimit-Limit', String(points));
      res.setHeader(
        'X-RateLimit-Remaining',
        String(rateResult.remainingPoints),
      );
      res.setHeader(
        'X-RateLimit-Reset',
        String(Math.ceil(Date.now() / 1000 + rateResult.msBeforeNext / 1000)),
      );

      next();
    } catch (rateResult) {
      const retryAfter = Math.ceil(
        (rateResult as { msBeforeNext?: number }).msBeforeNext ??
          (duration * 1000) / 1000,
      );

      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }
  };
};

export const globalLimiter = createLimiter({
  points: 1000,
  duration: 60,
  keyPrefix: 'global',
});

export const authLimiter = createLimiter({
  points: 5,
  duration: 15 * 60,
  keyPrefix: 'auth',
});

export const signupLimiter = createLimiter({
  points: 10,
  duration: 60 * 60,
  keyPrefix: 'signup',
});

export const searchLimiter = createLimiter({
  points: 100,
  duration: 60,
  keyPrefix: 'search',
});

export const apiLimiter = createLimiter({
  points: 100,
  duration: 15 * 60,
  keyPrefix: 'api',
  keyGenerator: req =>
    req.user?.id?.toString() || req.clientIp || req.ip || '127.0.0.1',
});

export default {
  apiLimiter,
  authLimiter,
  globalLimiter,
  searchLimiter,
  signupLimiter,
};
