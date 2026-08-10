/* eslint-disable no-undef */
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const EnvSchema = z.object({
  IP_ADDRESS: z.string().optional().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.string().optional().default('3000'),
  BCRYPT_SALT_ROUNDS: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().optional(),
  QUEUE_CONCURRENCY: z.string().optional().default('10'),
  SMS_WEBHOOK_URL: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_MAPS: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRE_IN: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PORT: z.string().optional(),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  GPT_API: z.string().optional(),
  GPT_MODEL_URL: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${JSON.stringify(parsed.error.format())}`,
  );
}

const env = parsed.data;

export default {
  ip_address: env.IP_ADDRESS,
  database_url: env.DATABASE_URL,
  node_env: env.NODE_ENV,
  port: Number(env.PORT),
  bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,
  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
  },
  queue: {
    concurrency: Number(env.QUEUE_CONCURRENCY || 10),
  },
  sms: {
    webhookUrl: env.SMS_WEBHOOK_URL,
    apiKey: env.SMS_API_KEY,
    senderId: env.SMS_SENDER_ID,
  },
  stripe_api_secret: env.STRIPE_SECRET_KEY,
  google_maps: env.GOOGLE_MAPS,
  jwt: {
    jwt_secret: env.JWT_SECRET,
    jwt_expire_in: env.JWT_EXPIRE_IN,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
    jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  payment: {
    stripe_secret_key: env.STRIPE_SECRET_KEY,
    stripe_webhook_secret: env.STRIPE_WEBHOOK_SECRET,
  },
  email: {
    from: env.EMAIL_FROM,
    user: env.EMAIL_USER,
    port: env.EMAIL_PORT,
    host: env.EMAIL_HOST,
    pass: env.EMAIL_PASS,
  },
  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },
  gpt: {
    key: env.GPT_API,
    gpt_model_url: env.GPT_MODEL_URL,
  },
};
