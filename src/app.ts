import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { logger } from '@common/logger';
import { globalErrorHandler } from '@common/middleware/globalErrorHandler';
import { generateOpenApiDocument } from '@common/openapi/document';
import routes from './routes';

export function createApp(): Express {
    const app = express();

    app.use(helmet());
    app.use(cors());
    app.use(compression());
    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));
    app.use(pinoHttp({ logger }));

    app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

    const openApiDocument = generateOpenApiDocument();
    app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

    app.use('/api', routes);
    app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
    app.use(globalErrorHandler);

    return app;
}