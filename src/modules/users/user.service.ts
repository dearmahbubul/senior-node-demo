import bcrypt from 'bcrypt';
import { userRepository } from './user.repository';
import { AppError } from '@common/errors/AppError';
import { CreateUserDto } from './user.validator';

const SALT_ROUNDS = 12;

/*function toSafeUser(user: { id: string; email: string; name: string | null; createdAt: Date }) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}*/

export const userService = {
  async createUser(input: CreateUserDto) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, `Email already in use`, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    return await userRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    // return toSafeUser(user);
  },

  async getUserById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) {
        throw new AppError(404, `User not found.`, 'USER_NOT_FOUND');
    }
    return user;
    // return toSafeUser(user);
  },
};