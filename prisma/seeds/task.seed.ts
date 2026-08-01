import { prisma } from '@prisma/client';
import { makeTasks } from '../factories/task.factory';

export async function seedTasks() {
  const users = await prisma.user.findMany({ select: { id: true } });

  if (users.length === 0) {
    console.warn('No users found — skipping task seeding. Seed users first.');
    return [];
  }

  const userIds = users.map((u) => u.id);
  const tasks = await makeTasks(userIds, 30);

  console.log(`Seeded ${tasks.length} tasks.`);
  return tasks;
}