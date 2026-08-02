import { NextFunction, Request, Response } from 'express';

const publicCacheRouteMatchers = [
  /^\/health$/,
  /^\/ready$/,
  /^\/detailed$/,
  /^\/metrics$/,
  /^\/api\/v1\/(about|privacy|terms|setting)(\/|$)/,
];

const cacheHeaders = (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return next();
  }

  const isPublic = publicCacheRouteMatchers.some(pattern =>
    pattern.test(req.path),
  );

  res.setHeader(
    'Cache-Control',
    isPublic
      ? 'public, max-age=300, stale-while-revalidate=900'
      : 'private, no-store, max-age=0',
  );
  res.setHeader('Vary', 'Authorization, Accept-Encoding');
  next();
};

export default cacheHeaders;
