import type { TaskStatus } from '../../src/generated/prisma/enums';

import { prisma } from '@prisma/client';

export async function makeTask(
    userId: string,
    overrides: Partial<{ title: string; status: TaskStatus }> = {},
) {
    const { faker } = await import('@faker-js/faker');

    return prisma.task.create({
        data: {
            title: overrides.title ?? faker.hacker.phrase(),
            status: overrides.status ?? 'PENDING',
            userId,
        },
    });
}

export async function makeTasks(userIds: string[], count: number) {
    const { faker } = await import('@faker-js/faker');

    return Promise.all(
        Array.from({ length: count }, () => {
            const userId = faker.helpers.arrayElement(userIds);
            return makeTask(userId);
        }),
    );
}