import mongoose from 'mongoose';
import chalk from 'chalk';
import config from './config';
import { startQueueWorkers, closeQueueWorkers } from './queues/queueManager';
import { logger, errorLogger } from './shared/logger';

process.on('uncaughtException', error => {
  errorLogger.error('Uncaught Exception in worker', error);
  process.exit(1);
});

let running = false;

async function main() {
  try {
    if (config.database_url) {
      await mongoose.connect(config.database_url as string);
      logger.info(chalk.green('Worker: Database connected successfully'));
    }

    await startQueueWorkers();
    running = true;
    logger.info(chalk.yellow('Worker: Queue workers started'));
  } catch (error) {
    errorLogger.error('Worker failed to start', error);
    process.exit(1);
  }

  process.on('unhandledRejection', error => {
    errorLogger.error('Worker unhandledRejection', error as Error);
    if (running) {
      shutdown('unhandledRejection');
    } else {
      process.exit(1);
    }
  });
}

main();

const shutdown = async (signal = 'SIGINT') => {
  logger.info(`Worker ${signal} received, shutting down gracefully`);
  try {
    await closeQueueWorkers();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    errorLogger.error('Worker graceful shutdown failed', error as Error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
