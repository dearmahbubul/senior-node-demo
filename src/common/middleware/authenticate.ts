import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '@modules/auth/token.util';
import { AppError } from '../errors/AppError';

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return next(new AppError('Missing or invalid authorization header', 401));
    }

    const token = header.split(' ')[1];

    try {
        req.user = verifyAccessToken(token);
        next();
    } catch {
        next(new AppError('Invalid or expired token', 401));
    }
}