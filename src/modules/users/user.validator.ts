// src/modules/user/user.validator.ts
import { z } from 'zod';
import { registry } from '@common/openapi/registry';

// ==========================================
// 1. Zod v4 Standalone Schemas
// ==========================================

export const createUserSchema = z.object({
    body: z.object({
        // ✅ FIX: Modern top-level Zod v4 syntax
        email: z.email({ message: 'Invalid email address format' }),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        name: z.string().trim().min(1, 'Name cannot be empty').optional(),
    }),
});

export const getUserParamsSchema = z.object({
    params: z.object({
        // ✅ FIX: Modern top-level Zod v4 syntax
        id: z.uuid({ message: 'Invalid user ID format' }),
    }),
});

// ==========================================
// 2. Strong Extracted DTO Types
// ==========================================

export type CreateUserDto = z.infer<typeof createUserSchema>['body'];
export type UserParamsDto = z.infer<typeof getUserParamsSchema>['params'];

// ==========================================
// 3. Centralized OpenAPI Registration
// ==========================================

registry.registerPath({
    method: 'post',
    path: '/api/users',
    tags: ['User'],
    summary: 'Register a new user',
    request: {
        body: {
            content: {
                'application/json': { schema: createUserSchema.shape.body },
            },
        },
    },
    responses: {
        201: { description: 'User account created successfully' },
        400: { description: 'Input validation failure' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/users/{id}',
    tags: ['User'],
    summary: 'Retrieve user details by ID',
    request: {
        params: getUserParamsSchema.shape.params,
    },
    responses: {
        200: { description: 'User found' },
        404: { description: 'User not found' },
    },
});
