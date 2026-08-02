import { JwtPayload } from 'jsonwebtoken';
import { Server } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var io: Server | undefined;
  // eslint-disable-next-line no-var
  var queueReady: boolean | undefined;

  namespace Express {
    interface Request {
      user: JwtPayload;
      requestId?: string;
      requestStartedAt?: number;
      clientIp?: string;
    }
  }
}
