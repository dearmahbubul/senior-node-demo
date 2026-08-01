import { prisma } from '../../prisma/client';
import { User } from '../../generated/prisma/client';

export const userRepository = {
  create: (data: { email: string; passwordHash: string; name?: string }): Promise<User> =>
    prisma.user.create({ data }),

  findByEmail: (email: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { email } }),

  findById: (id: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { id } }),
};