import { z } from 'zod';
import { registry } from '@common/openapi/registry';

export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1).optional(),
});

registry.registerPath({
    method: 'post',
    path: '/api/users',
    tags: ['User'],
    request: {
        body: { content: { 'application/json': { schema: createUserSchema } } },
    },
    responses: {
        200: { description: 'Created successful' },
        422: { description: 'Invalid data' },
    },
});

export type CreateUserDto = z.infer<typeof createUserSchema>;