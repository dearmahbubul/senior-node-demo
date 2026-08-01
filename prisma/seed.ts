import { seedUsers } from './seeds/user.seed';
import { seedTasks } from './seeds/task.seed';
import { prisma } from '@prisma/client';

async function main() {
    const { admin, users } = await seedUsers();
    const tasks = await seedTasks();

    console.log(`Seed complete: 1 admin (${admin.email}), ${users.length} users, ${tasks.length} tasks`);
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());