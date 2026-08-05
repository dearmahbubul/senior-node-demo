import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ApiResponse } from '../types/response';

export const globalErrorHandler = (
    err: Error | AppError,
    _req: Request,
    res: Response<ApiResponse>,
    _next: NextFunction,
) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const errorCode = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';

    // High-reliability logging system integration goes here (e.g., Winston/Datadog)
    console.error(`[API ERROR] [${errorCode}]:`, err);

    res.status(statusCode).json({
        success: false,
        message: err.message || 'An unexpected error occurred on the server.',
        error: {
            code: errorCode,
            // Provide deep contextual details in development; mask strings in production
            details: err instanceof AppError ? err.details : null,
        },
        meta: { timestamp: new Date().toISOString() },
    });
};


/*
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn({ err }, err.message);
    return res.status(err.status).json({ error: err.message });
  }

  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({ error: 'Internal Server Error' });
}*/
