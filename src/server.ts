import { createApp } from './app';
import { env } from '@config/env';
import { logger } from '@common/logger';
import { prisma } from '@db/client';
import { closeRedis } from '@common/middleware/rateLimiter';
import { disconnectQueue } from '@common/queue/rabbitmq';

const app = createApp();

const server = app.listen(env.port, () => {
    logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
});

// Graceful shutdown — important for Kubernetes rolling deploys later.
// Order matters: stop accepting requests first, then drain, then close clients.
function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down gracefully`);
    const forceExit = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000).unref(); // .unref(): this timer alone must NOT keep the process alive

    server.close(async () => {
        // In-flight requests are done. Now release external resources.
        await Promise.allSettled([prisma.$disconnect(), closeRedis(), disconnectQueue()]);
        logger.info('Server closed');
        clearTimeout(forceExit);
        process.exit(0);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Fail fast and loudly on programmer errors — never swallow these
process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
});
