import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { logger } from './common/logger';
import { errorHandler } from './common/middleware/errorHandler';
import routes from './routes';

export function createApp(): Express {
  const app = express();

  // Security headers — always first
  app.use(helmet());

  // CORS — restrict in production via env-driven allowlist later
  app.use(cors());

  // Gzip responses
  app.use(compression());

  // Parse JSON bodies, with a sane size limit (prevents payload-based DoS)
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Structured request logging
  app.use(pinoHttp({ logger }));

  // Health check — every deployable service needs one (Kubernetes will use this later)
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // API routes
  app.use('/api', routes);

  // 404 handler — must come after all real routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Centralized error handler — must be last
  app.use(errorHandler);

  return app;
}