import { makeUser, makeUsers } from '../factories/user.factory';

export async function seedUsers() {
  const admin = await makeUser({
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'password123',
  });

  const users = await makeUsers(20);

  return { admin, users };
}