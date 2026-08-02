import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import config from '../config';
import { Notification } from '../app/modules/notifications/notifications.model';
import { sendMailDirect } from '../shared/mailTransport';
import { sendSmsDirect } from '../shared/smsTransport';
import { errorLogger, logger } from '../shared/logger';

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

const enqueueNotification = async (payload: QueueJobPayload) => {
  if (!notificationQueue) {
    const record = await Notification.create(payload);
    const io = global.io;

    if (io) {
      const receiver =
        payload?.type === 'ADMIN'
          ? 'ADMIN'
          : payload?.receiver?.toString?.() || payload?.receiver;
      io.emit(
        payload?.type === 'ADMIN'
          ? `get-notification::ADMIN`
          : `get-notification::${receiver}`,
        record,
      );
    }

    return record;
  }

  return notificationQueue.add('send-notification', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
};

const startQueueWorkers = async () => {
  if (!queueConnection || global.queueReady) {
    global.queueReady = Boolean(queueConnection);
    return;
  }

  const concurrency = config.queue.concurrency;

  const emailWorker = new Worker(
    'email',
    async job => sendMailDirect(job.data),
    {
      connection: queueConnection,
      concurrency,
    },
  );

  const smsWorker = new Worker('sms', async job => sendSmsDirect(job.data), {
    connection: queueConnection,
    concurrency,
  });

  const notificationWorker = new Worker(
    'notification',
    async job => {
      const record = await Notification.create(job.data);
      const io = global.io;

      if (io) {
        const receiver =
          job.data?.type === 'ADMIN'
            ? 'ADMIN'
            : job.data?.receiver?.toString?.() || job.data?.receiver;
        io.emit(
          job.data?.type === 'ADMIN'
            ? `get-notification::ADMIN`
            : `get-notification::${receiver}`,
          record,
        );
      }

      return record;
    },
    {
      connection: queueConnection,
      concurrency,
    },
  );

  workers.push(emailWorker, smsWorker, notificationWorker);

  workers.forEach(worker => {
    worker.on('completed', job => {
      logger.info(`Queue job completed: ${worker.name}:${job.id}`);
    });
    worker.on('failed', (job, error) => {
      errorLogger.error(
        `Queue job failed: ${worker.name}:${job?.id ?? 'unknown'} - ${(error as Error).message}`,
      );
    });
  });

  global.queueReady = true;
  logger.info('Queue workers started');
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

export {
  closeQueueWorkers,
  enqueueEmail,
  enqueueNotification,
  enqueueSms,
  startQueueWorkers,
};
