import jwt from 'jsonwebtoken';
import { env } from '@config/env';

export interface JwtPayload {
    sub: string; // user id — "sub" is the JWT-standard claim name for subject
    email: string;
}

export function signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.jwtSecret, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwtSecret) as unknown as JwtPayload;
}