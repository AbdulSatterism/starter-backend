/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
import chalk from 'chalk';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import app from './app';
import config from './config';
import { closeQueueWorkers } from './queues/queueManager';
import { socketHelper } from './helpers/socketHelper';
import { errorLogger, logger } from './shared/logger';
import { redisStore } from './shared/redis';
import seedAdmin from './DB';

//uncaught exception
process.on('uncaughtException', error => {
  errorLogger.error('UnhandleException Detected', error);
  process.exit(1);
});

let server: any;
async function main() {
  try {
    await mongoose.connect(config.database_url as string);
    logger.info(chalk.green('🚀 Database connected successfully'));

    if (redisStore.enabled) {
      await redisStore.ping();
      logger.info(chalk.green('🚀 Redis connection healthy'));
    }

    const port =
      typeof config.port === 'number' ? config.port : Number(config.port);

    server = app.listen(port, config.ip_address as string, () => {
      logger.info(
        chalk.yellow(`♻️  Application listening on port:${config.port}`),
      );
    });

    await seedAdmin();

    //socket
    const io = new Server(server, {
      pingTimeout: 60000,
      cors: {
        origin: '*',
      },
    });
    socketHelper.socket(io);
    //@ts-ignore
    global.io = io;

    // queue workers should run in a separate process (see src/worker.ts)
  } catch (error) {
    errorLogger.error(chalk.red('🤢 Failed to connect Database'));
    process.exit(1);
  }

  //handle unhandleRejection
  process.on('unhandledRejection', error => {
    if (server) {
      server.close(() => {
        errorLogger.error('UnhandleRejection Detected', error);
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });
}

main();

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    if (server) {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
      });
    }

    if (global.io) {
      global.io.close();
    }

    await closeQueueWorkers();

    await mongoose.connection.close();
    await redisStore.close();

    process.exit(0);
  } catch (error) {
    errorLogger.error(`Graceful shutdown failed: ${(error as Error).message}`);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
