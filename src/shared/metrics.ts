import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'starter_backend_',
});

const httpRequestsTotal = new client.Counter({
  name: 'starter_backend_http_requests_total',
  help: 'Total number of HTTP requests processed.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'starter_backend_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const httpActiveRequests = new client.Gauge({
  name: 'starter_backend_http_active_requests',
  help: 'Number of active HTTP requests.',
  registers: [register],
});

const routeLabel = (req: Request) => {
  const routePath = req.route?.path;

  if (typeof routePath === 'string') {
    return `${req.baseUrl || ''}${routePath}` || req.path;
  }

  if (Array.isArray(routePath)) {
    return `${req.baseUrl || ''}${routePath[0]}` || req.path;
  }

  return req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
};

const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  httpActiveRequests.inc();
  const endTimer = httpRequestDurationSeconds.startTimer();
  let completed = false;

  const finalize = () => {
    if (completed) {
      return;
    }

    completed = true;
    httpActiveRequests.dec();
  };

  res.on('finish', () => {
    const route = routeLabel(req);
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    endTimer({
      method: req.method,
      route,
      status_code: statusCode,
    });

    finalize();
  });

  res.on('close', () => {
    finalize();
  });

  next();
};

const metricsHandler = async (_req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};

export {
  httpActiveRequests,
  httpRequestDurationSeconds,
  httpRequestsTotal,
  metricsHandler,
  metricsMiddleware,
  register,
};
