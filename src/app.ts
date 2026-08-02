import cors from 'cors';
import compression from 'compression';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import cacheHeaders from './app/middlewares/cacheHeaders';
import requestTracker from './app/middlewares/requestTracker';
import { globalLimiter, apiLimiter } from './app/middlewares/rateLimiters';
import { metricsHandler, metricsMiddleware } from './shared/metrics';
import { redisStore } from './shared/redis';
import router from './routes';
import { Morgan } from './shared/morgen';
import notFoundRoute from './app/middlewares/notFoundRoute';
import config from './config';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(requestTracker);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cacheHeaders);
app.use(globalLimiter);
app.use(metricsMiddleware);

//morgan
app.use(Morgan.successHandler);
app.use(Morgan.errorHandler);

//body parser
app.use(
  cors({
    origin: '*',
    credentials: true,
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

//file retrieve
app.use(express.static('uploads', { maxAge: '1h', etag: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    requestId: _req.requestId,
  });
});

app.get('/ready', async (_req: Request, res: Response) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisReady = redisStore.enabled ? await redisStore.ping() : true;
  const ready = mongoReady && redisReady;

  res.status(ready ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    success: ready,
    status: ready ? 'ready' : 'degraded',
    mongo: mongoReady,
    redis: redisStore.enabled ? redisReady : 'disabled',
    nodeEnv: config.node_env,
  });
});

app.get('/detailed', async (_req: Request, res: Response) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisReady = redisStore.enabled ? await redisStore.ping() : true;

  res.status(StatusCodes.OK).json({
    success: true,
    status: 'detailed',
    uptime: process.uptime(),
    requestId: _req.requestId,
    mongo: {
      ready: mongoReady,
      state: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    },
    redis: {
      enabled: redisStore.enabled,
      ready: redisReady,
    },
    memory: process.memoryUsage(),
    pid: process.pid,
    nodeEnv: config.node_env,
  });
});

app.get('/metrics', metricsHandler);

//router
app.use('/api/v1', apiLimiter, router);

//live response
app.get('/', (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Starter backend is running',
    requestId: req.requestId,
  });
});

app.use(notFoundRoute);

//global error handle
app.use(globalErrorHandler);

export default app;
