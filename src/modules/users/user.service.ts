import bcrypt from 'bcrypt';
import { userRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { AppError } from '../../common/errors/AppError';

const SALT_ROUNDS = 12;

function toSafeUser(user: { id: number; email: string; name: string | null; createdAt: Date }) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export const userService = {
  async createUser(input: CreateUserDto) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('Email already in use', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    return toSafeUser(user);
  },

  async getUserById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('User not found', 404);
    return toSafeUser(user);
  },
};