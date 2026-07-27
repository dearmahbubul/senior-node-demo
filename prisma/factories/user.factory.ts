import bcrypt from 'bcrypt';
import { prisma } from '@prisma/client';

export async function makeUser(
    overrides: Partial<{ email: string; name: string; password: string}> = {},
) {
    const { faker } = await import('@faker-js/faker');
    const passwordHash = await bcrypt.hash(overrides.password ?? 'password123', 12);

    return prisma.user.create({
        data: {
            email: overrides.email ?? faker.internet.email().toLowerCase(),
            passwordHash,
            name: overrides.name ?? faker.person.fullName(),
        },
    });
}

export async function makeUsers(count: number) {
    return Promise.all(Array.from({ length: count }, () => makeUser()));
}