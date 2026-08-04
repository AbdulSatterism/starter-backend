/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config';
import { sendMailDirect } from '../shared/mailTransport';
import { sendSmsDirect } from '../shared/smsTransport';

type QueueJobPayload = Record<string, any>;

const queueEnabled = Boolean(config.redis.url);

const createConnection = () => {
  if (!queueEnabled || !config.redis.url) {
    return null;
  }

  return new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });
};

const queueConnection = createConnection();

const defaultJobOptions: JobsOptions = {
  removeOnComplete: 1000,
  removeOnFail: 5000,
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
};

const emailQueue = queueConnection
  ? new Queue('email', {
      connection: queueConnection,
      defaultJobOptions,
    })
  : null;

const smsQueue = queueConnection
  ? new Queue('sms', {
      connection: queueConnection,
      defaultJobOptions,
    })
  : null;

const notificationQueue = queueConnection
  ? new Queue('notification', {
      connection: queueConnection,
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 3,
      },
    })
  : null;

const workers: Worker[] = [];

const enqueueEmail = async (payload: QueueJobPayload) => {
  if (!emailQueue) {
    return sendMailDirect(payload as any);
  }

  return emailQueue.add('send-email', payload, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
};

const enqueueSms = async (payload: QueueJobPayload) => {
  if (!smsQueue) {
    return sendSmsDirect(payload as any);
  }

  return smsQueue.add('send-sms', payload, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
};

const closeQueueWorkers = async () => {
  await Promise.all(workers.map(worker => worker.close()));
  workers.length = 0;

  await Promise.all(
    [
      emailQueue?.close(),
      smsQueue?.close(),
      notificationQueue?.close(),
      queueConnection?.quit(),
    ].filter(Boolean) as Promise<unknown>[],
  );
};

export { closeQueueWorkers, enqueueEmail, enqueueSms };
