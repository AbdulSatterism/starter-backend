import axios from 'axios';
import config from '../config';
import { logger } from './logger';

export type SmsPayload = {
  to: string;
  message: string;
  meta?: Record<string, unknown>;
};

const sendSmsDirect = async (payload: SmsPayload) => {
  if (!config.sms.webhookUrl) {
    logger.info(`SMS fallback [${payload.to}]: ${payload.message}`);
    return { provider: 'fallback', success: true };
  }

  const response = await axios.post(config.sms.webhookUrl, {
    apiKey: config.sms.apiKey,
    senderId: config.sms.senderId,
    to: payload.to,
    message: payload.message,
    meta: payload.meta || {},
  });

  logger.info(`SMS sent to ${payload.to}`);
  return response.data;
};

export { sendSmsDirect };
