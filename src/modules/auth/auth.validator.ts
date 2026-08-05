import { z } from 'zod';
import { registry } from '@common/openapi/registry';

// ==========================================
// 1. Zod v4 Standalone Validation Schemas
// ==========================================

export const loginSchema = z.object({
    body: z.object({
        // ✅ FIX: Modern top-level Zod v4 standalone function
        email: z.email({ message: 'Invalid email address format' }),
        password: z.string().min(1, 'Password field cannot be empty'),
    }),
});

// ==========================================
// 2. Strong Extracted DTO Types
// ==========================================

export type LoginDto = z.infer<typeof loginSchema>['body'];

// ==========================================
// 3. Centralized OpenAPI / Swagger Documentation
// ==========================================

registry.registerPath({
    method: 'post',
    path: '/api/auth/login',
    tags: ['Authentication'],
    summary: 'Authenticate user credentials',
    request: {
        body: {
            content: {
                'application/json': { schema: loginSchema.shape.body },
            },
        },
    },
    responses: {
        200: { description: 'Authentication token dispatched successfully' },
        400: { description: 'Input structure validation fallback error' },
        401: { description: 'Invalid security credentials provided' },
    },
});
