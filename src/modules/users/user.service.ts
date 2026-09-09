import bcrypt from 'bcrypt';
import { userRepository } from './user.repository';
import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { CreateUserDto } from './user.validator';

const SALT_ROUNDS = 12;

export const userService = {
    async createUser(input: CreateUserDto) {
        const existing = await userRepository.findByEmail(input.email);
        if (existing) {
            throw new AppError(409, 'Email already in use', 'EMAIL_EXISTS');
        }

        const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
        return userRepository.create({
            email: input.email,
            passwordHash,
            name: input.name,
        });
    },

    async getUserById(id: string) {
        const user = await userRepository.findById(id);
        if (!user) {
            throw new NotFoundError('User not found.', 'USER_NOT_FOUND');
        }
        return user;
    },
};
