import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn({ err }, err.message);
    return res.status(err.status).json({ error: err.message });
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
}