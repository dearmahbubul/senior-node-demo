import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { env } from '@config/env';

export interface JwtPayload {
    sub: string; // User ID
    email: string;
}

// Ensure the secret exists at runtime
const JWT_SECRET = env.jwtSecret;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is missing from environmental variables.');
}

/**
 * Signs a short-lived access token (15 minutes)
 */
export function signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '15m',
        algorithm: 'HS256', // Explicitly define the algorithm to prevent substitution attacks
    });
}

/**
 * Signs a longer-lived refresh token (7 days)
 */
export function signRefreshToken(payload: Pick<JwtPayload, 'sub'>): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '7d',
        algorithm: 'HS256',
    });
}

/**
 * Safely verifies a token and handles errors without crashing
 */
export function verifyToken(
    token: string,
): { valid: true; payload: JwtPayload } | { valid: false; error: string } {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

        // Type guard check
        if (
            typeof decoded === 'object' &&
            decoded !== null &&
            'sub' in decoded &&
            'email' in decoded
        ) {
            return { valid: true, payload: decoded as JwtPayload };
        }

        return { valid: false, error: 'Invalid token payload structure' };
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            return { valid: false, error: 'Token has expired' };
        }
        if (error instanceof JsonWebTokenError) {
            return { valid: false, error: 'Token tampering or malformed structure detected' };
        }
        return { valid: false, error: 'An unknown error occurred during token verification' };
    }
}
