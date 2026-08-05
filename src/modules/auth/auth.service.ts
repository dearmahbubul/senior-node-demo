import bcrypt from 'bcrypt';
import { userRepository } from '../users/user.repository';
import { LoginDto } from './auth.validator';
import { AppError } from '@common/errors/AppError';
import { signAccessToken } from './token.util';

export const authService = {
    /**
     * Authenticates user, verifies integrity states, and signs access claims.
     */
    async login(input: LoginDto) {
        const user = await userRepository.findByEmail(input.email);

        // 🛡️ SECURITY FIX: Defend against user enumeration/timing attacks.
        // If user is missing, compare password against a dummy hash to keep execution time constant.
        const dummyHash = '$2b$10$abcdefghijklmnopqrstuvwxyzaFakeHashForTimingAttacks';
        const passwordHashToCompare = user ? user.passwordHash : dummyHash;
        const passwordMatches = await bcrypt.compare(input.password, passwordHashToCompare);

        // Standardized generic error prevents attacker from discovering valid registered emails
        if (!user || !passwordMatches) {
            throw new AppError(
                401,
                'Invalid email or password credentials.',
                'INVALID_CREDENTIALS',
            );
        }

        const token = signAccessToken({ sub: user.id, email: user.email });

        return { token, user };
    },
};
