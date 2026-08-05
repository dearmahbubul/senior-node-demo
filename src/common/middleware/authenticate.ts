import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@modules/auth/token.util';
import { AppError } from '../errors/AppError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const authorizationHeader = req.headers.authorization;

    // 1. Structural Guard Rule: Enforce Bearer protocol presence
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return next(
            new AppError(401, 'Missing or malformed Authorization header.', 'UNAUTHORIZED'),
        );
    }

    // 2. Safe array destructuring: Use an underscore to cleanly omit the unused 'Bearer' prefix element
    const [, rawToken] = authorizationHeader.split(' ');

    // 3. Safety Guard Rule: Catch missing or empty token payloads
    if (!rawToken || rawToken.trim() === '') {
        return next(
            new AppError(401, 'Bearer credentials payload cannot be empty.', 'INVALID_TOKEN'),
        );
    }

    // 4. Pass the extracted string token into our verification handler
    const verificationResult = verifyToken(rawToken);

    if (!verificationResult.valid) {
        return next(new AppError(401, verificationResult.error, 'INVALID_TOKEN'));
    }

    // 5. Inject the verified claims into the Request object
    req.user = verificationResult.payload;

    return next();
}
