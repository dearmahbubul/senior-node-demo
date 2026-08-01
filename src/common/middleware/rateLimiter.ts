import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import { env } from '@config/env';

const redisClient = new Redis(env.redisUrl);

export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
    store: new RedisStore({
        sendCommand: (command: string, ...args: string[]) =>
            redisClient.call(command, ...args) as Promise<RedisReply>,
    }),
});