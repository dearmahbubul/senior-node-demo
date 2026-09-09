import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '@common/logger';
import { ApiResponse } from '../types/response';

export const globalErrorHandler = (
    err: Error | AppError,
    _req: Request,
    res: Response<ApiResponse>,
    _next: NextFunction,
) => {
    // Known, intentional errors (AppError family): warn-level is enough.
    // Unknown errors: log the full stack — this is what you debug incidents with.
    if (err instanceof AppError) {
        logger.warn({ err, code: err.code }, err.message);
    } else {
        logger.error({ err }, 'Unhandled error');
    }

    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const errorCode = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';

    res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500 && process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred on the server.'
                : err.message || 'An unexpected error occurred on the server.',
        error: {
            code: errorCode,
            details: err instanceof AppError ? err.details : null,
        },
        meta: { timestamp: new Date().toISOString() },
    });
};
