import 'dotenv/config';
import { z } from 'zod';
import { envSchema } from './env.schema';

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  databaseUrl: raw.DATABASE_URL,
  jwtSecret: raw.JWT_SECRET,
  logLevel: raw.LOG_LEVEL,
  rabbitmqUrl: raw.RABBITMQ_URL,
  redisUrl: raw.REDIS_URL,
};