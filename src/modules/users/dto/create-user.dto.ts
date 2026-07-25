import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;