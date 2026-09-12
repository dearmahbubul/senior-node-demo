import { z } from 'zod';

export const envSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        PORT: z.coerce.number().int().positive().default(3010),
        DATABASE_URL: z.url(),
        JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
        LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
        APP_BASE_HOST: z.string().min(1).default('localhost'),
        RABBITMQ_URL: z.url().default('amqp://admin:admin@localhost:5672'),
        REDIS_URL: z.url().default('redis://localhost:6379'),

        // Storage
        STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
        UPLOAD_DIR: z.string().default('uploads'),
        MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),
        S3_REGION: z.string().optional(),
        S3_BUCKET: z.string().optional(),
        S3_ACCESS_KEY_ID: z.string().optional(),
        S3_SECRET_ACCESS_KEY: z.string().optional(),
        S3_ENDPOINT: z.url().optional(), // MinIO / LocalStack compatible endpoint

    // Mail (all optional: without SMTP_HOST the dev transport logs instead of sending)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('noreply@senior-node.local'),
    APP_URL: z.url().default('http://localhost:3010'),
    })
    .superRefine((cfg, ctx) => {
        if (cfg.STORAGE_DRIVER === 's3') {
            const required: Array<[keyof typeof cfg, string]> = [
                ['S3_BUCKET', 'S3_BUCKET is required when STORAGE_DRIVER=s3'],
                ['S3_REGION', 'S3_REGION is required when STORAGE_DRIVER=s3'],
                ['S3_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID is required when STORAGE_DRIVER=s3'],
                ['S3_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=s3'],
            ];
            for (const [key, message] of required) {
                if (!cfg[key]) {
                    ctx.addIssue({ code: 'custom', path: [key], message });
                }
            }
        }
    });

export type Env = z.infer<typeof envSchema>;
