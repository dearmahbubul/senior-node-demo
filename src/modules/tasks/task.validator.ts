import { z } from 'zod';
import { registry } from '@common/openapi/registry';

// ==========================================
// 1. Zod v4 Standalone Schemas (No More Chaining)
// ==========================================

export const createTaskSchema = z.object({
    body: z.object({
        title: z.string().min(3, 'Title must be at least 3 characters').max(100),
        description: z.string().max(1000).optional(),
        // ✅ FIX: Using modern top-level z.uuid() instead of .string().uuid()
        userId: z.uuid('Invalid creator User ID format'),
        assignedToId: z.uuid('Invalid assignee User ID format').optional(),
    }),
});

export const updateTaskStatusSchema = z.object({
    params: z.object({
        // ✅ FIX: Modern top-level z.uuid()
        id: z.uuid('Invalid task ID format'),
    }),
    body: z.object({
        status: z.enum(['PENDING', 'PROCESSING', 'PROCESSED', 'DONE']),
    }),
});

export const getTaskParamsSchema = z.object({
    params: z.object({
        // ✅ FIX: Modern top-level z.uuid()
        id: z.uuid('Invalid task ID format'),
    }),
});

// ==========================================
// 2. Inferred DTO Types
// ==========================================

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>['body'];
export type TaskParamsInput = z.infer<typeof getTaskParamsSchema>['params'];

// ==========================================
// 3. Centralized OpenAPI / Swagger Documentation
// ==========================================

registry.registerPath({
    method: 'post',
    path: '/api/tasks',
    tags: ['Tasks'],
    summary: 'Create a new task tracking ticket',
    request: {
        body: {
            content: {
                'application/json': { schema: createTaskSchema.shape.body },
            },
        },
    },
    responses: {
        201: { description: 'Task initialized successfully' },
        400: { description: 'Bad request / Input validation failure' },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/api/tasks/{id}/status',
    tags: ['Tasks'],
    summary: 'Transition a task to a different execution state',
    request: {
        params: updateTaskStatusSchema.shape.params,
        body: {
            content: {
                'application/json': { schema: updateTaskStatusSchema.shape.body },
            },
        },
    },
    responses: {
        200: { description: 'Task state changed successfully' },
        400: { description: 'Invalid status validation fallback' },
        404: { description: 'Target task tracking link not found' },
    },
});
