import bcrypt from 'bcrypt';
import { userRepository } from '../users/user.repository';
import { LoginDto } from './dto/login.dto';
import { AppError } from '@common/errors/AppError';
import { signAccessToken } from './token.util';

export const authService = {
    async login(input: LoginDto) {
        const user = await userRepository.findByEmail(input.email);
        if (!user) {
            throw new AppError('Invalid email or password', 401);
        }

        const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
        if (!passwordMatches) {
            throw new AppError('Invalid email or password', 401);
        }

        const token = signAccessToken({ sub: user.id, email: user.email });

        return {
            token,
            user: { id: user.id, email: user.email, name: user.name },
        };
    },
};