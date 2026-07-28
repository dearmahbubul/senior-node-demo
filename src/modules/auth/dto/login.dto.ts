import { z } from 'zod';
import { registry } from '@common/openapi/registry';

export const loginSchema = z.object({
    email: z.email().openapi({ example: 'admin@example.com' }),
    password: z.string().min(1).openapi({ example: 'password123' }),
});

registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Auth'],
    request: {
        body: { content: { 'application/json': { schema: loginSchema } } },
    },
    responses: {
        200: { description: 'Login successful' },
        401: { description: 'Invalid credentials' },
    },
});

export type LoginDto = z.infer<typeof loginSchema>;