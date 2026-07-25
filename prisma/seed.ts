import { prisma } from '../src/prisma/client';
import { seedUsers } from './seeds/user.seed';

async function main() {
  const { admin, users } = await seedUsers();

  console.log(`Seed complete: 1 admin (${admin.email}), ${users.length} users`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());