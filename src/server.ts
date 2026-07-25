import { createApp } from './app';
import { env } from './config/env';
import { logger } from './common/logger';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
});

// Graceful shutdown — important for Kubernetes rolling deploys later
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force-exit if it hangs (e.g. open DB connections not closing)
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));