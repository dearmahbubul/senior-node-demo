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
    appBaseHost: raw.APP_BASE_HOST,
    storage: {
        driver: raw.STORAGE_DRIVER,
        uploadDir: raw.UPLOAD_DIR,
        maxFileSizeMb: raw.MAX_FILE_SIZE_MB,
    s3: {
      region: raw.S3_REGION,
      bucket: raw.S3_BUCKET,
      accessKeyId: raw.S3_ACCESS_KEY_ID,
      secretAccessKey: raw.S3_SECRET_ACCESS_KEY,
      endpoint: raw.S3_ENDPOINT,
    },
  },
  mail: {
    host: raw.SMTP_HOST,
    port: raw.SMTP_PORT,
    user: raw.SMTP_USER,
    pass: raw.SMTP_PASS,
    from: raw.MAIL_FROM,
  },
  appUrl: raw.APP_URL,
};
