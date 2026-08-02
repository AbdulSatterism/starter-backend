/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import config from '../config';
import { errorLogger, logger } from './logger';

type CacheRecord = {
  value: string;
  expiresAt: number | null;
};

const memoryCache = new Map<string, CacheRecord>();
const memoryTags = new Map<string, Set<string>>();
const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

const redisEnabled = Boolean(config.redis.url);

const redisClient = redisEnabled
  ? new Redis(config.redis.url as string, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 10000,
    })
  : null;

if (redisClient) {
  redisClient.on('error', error => {
    errorLogger.error(`Redis error: ${(error as Error).message}`);
  });

  redisClient.on('connect', () => {
    logger.info('Redis connecting');
  });
}

const normalizeValue = <T>(value: T) => JSON.stringify(value);

const parseValue = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
};

const memoryGet = <T>(key: string): T | null => {
  const entry = memoryCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return parseValue<T>(entry.value);
};

const memorySet = <T>(
  key: string,
  value: T,
  ttlSeconds?: number,
  tags: string[] = [],
) => {
  memoryCache.set(key, {
    value: normalizeValue(value),
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });

  tags.forEach(tag => {
    const tagSet = memoryTags.get(tag) ?? new Set<string>();
    tagSet.add(key);
    memoryTags.set(tag, tagSet);
  });
};

const memoryDelete = async (key: string) => {
  memoryCache.delete(key);
  memoryTags.forEach(tagSet => tagSet.delete(key));
};

const memoryInvalidateTag = async (tag: string) => {
  const tagSet = memoryTags.get(tag);
  if (!tagSet) {
    return;
  }

  tagSet.forEach(key => memoryCache.delete(key));
  memoryTags.delete(tag);
};

const ensureRedisConnection = async () => {
  if (!redisClient) {
    return;
  }

  if (redisClient.status === 'wait') {
    await redisClient.connect();
  }
};

const redisStore = {
  client: redisClient,
  enabled: redisEnabled,
  async ping() {
    if (!redisClient) {
      return false;
    }

    try {
      await ensureRedisConnection();
      return (await redisClient.ping()) === 'PONG';
    } catch {
      return false;
    }
  },
  async get<T>(key: string) {
    if (!redisClient) {
      return memoryGet<T>(key);
    }

    await ensureRedisConnection();
    const value = await redisClient.get(key);
    return parseValue<T>(value);
  },
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    tags: string[] = [],
  ) {
    if (!redisClient) {
      memorySet(key, value, ttlSeconds, tags);
      return;
    }

    await ensureRedisConnection();
    const payload = normalizeValue(value);

    if (ttlSeconds) {
      await redisClient.set(key, payload, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, payload);
    }

    if (tags.length > 0) {
      await Promise.all(tags.map(tag => redisClient.sadd(`tag:${tag}`, key)));

      if (ttlSeconds) {
        await Promise.all(
          tags.map(tag => redisClient.expire(`tag:${tag}`, ttlSeconds)),
        );
      }
    }
  },
  async del(key: string) {
    if (!redisClient) {
      await memoryDelete(key);
      return;
    }

    await ensureRedisConnection();
    await redisClient.del(key);
  },
  async invalidateTag(tag: string) {
    if (!redisClient) {
      await memoryInvalidateTag(tag);
      return;
    }

    await ensureRedisConnection();
    const keys = await redisClient.smembers(`tag:${tag}`);

    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    await redisClient.del(`tag:${tag}`);
  },
  async incrementCounter(key: string, ttlSeconds = 60) {
    const counterKey = `counter:${key}`;

    if (!redisClient) {
      const currentValue = (await memoryGet<number>(counterKey)) ?? 0;
      const nextValue = currentValue + 1;
      memorySet(counterKey, nextValue, ttlSeconds);
      return nextValue;
    }

    await ensureRedisConnection();
    const nextValue = await redisClient.incr(counterKey);
    if (nextValue === 1) {
      await redisClient.expire(counterKey, ttlSeconds);
    }
    return nextValue;
  },
  async acquireLock(key: string, ttlMs = 10000) {
    const lockKey = `lock:${key}`;
    const token = randomUUID();

    if (!redisClient) {
      const lock = memoryLocks.get(lockKey);

      if (lock && lock.expiresAt > Date.now()) {
        return null;
      }

      memoryLocks.set(lockKey, {
        token,
        expiresAt: Date.now() + ttlMs,
      });

      return token;
    }

    await ensureRedisConnection();
    const result = await redisClient.set(lockKey, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  },
  async releaseLock(key: string, token: string) {
    const lockKey = `lock:${key}`;

    if (!redisClient) {
      const current = memoryLocks.get(lockKey);
      if (current?.token === token) {
        memoryLocks.delete(lockKey);
      }
      return;
    }

    await ensureRedisConnection();
    const releaseScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
    `;
    await redisClient.eval(releaseScript, 1, lockKey, token);
  },
  async setSession<T>(
    sessionId: string,
    value: T,
    ttlSeconds = 60 * 60 * 24 * 7,
  ) {
    await this.set(`session:${sessionId}`, value, ttlSeconds, ['session']);
  },
  async getSession<T>(sessionId: string) {
    return this.get<T>(`session:${sessionId}`);
  },
  async deleteSession(sessionId: string) {
    await this.del(`session:${sessionId}`);
  },
  async setOtp<T>(otpKey: string, value: T, ttlSeconds = 20 * 60) {
    await this.set(`otp:${otpKey}`, value, ttlSeconds, ['otp']);
  },
  async getOtp<T>(otpKey: string) {
    return this.get<T>(`otp:${otpKey}`);
  },
  async deleteOtp(otpKey: string) {
    await this.del(`otp:${otpKey}`);
  },
  async close() {
    if (redisClient) {
      await redisClient.quit();
    }
  },
};

export { redisStore };
