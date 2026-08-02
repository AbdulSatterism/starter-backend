import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const requestTracker = (req: Request, res: Response, next: NextFunction) => {
  const incomingRequestId = req.headers['x-request-id'];
  const requestId =
    typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
      ? incomingRequestId.trim()
      : randomUUID();

  req.requestId = requestId;
  req.requestStartedAt = Date.now();
  req.clientIp =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip;

  res.setHeader('x-request-id', requestId);
  next();
};

export default requestTracker;
