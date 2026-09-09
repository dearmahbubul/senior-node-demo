import { z } from 'zod';
import { registry } from '@common/openapi/registry';

// ==========================================
// 1. Zod v4 Standalone Schemas (No More Chaining)
// ==========================================

export const createTaskSchema = z.object({
    body: z.object({
        title: z.string().min(3, 'Title must be at least 3 characters').max(100),
        description: z.string().max(1000).optional(),
        // NOTE: no userId here — the creator is derived from the JWT, never the payload
        assignedToId: z.uuid('Invalid assignee User ID format').optional(),
    }),
});

/** Bare body schema — reused for the multipart create path (data JSON part). */
export const createTaskBodySchema = createTaskSchema.shape.body;

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

export const assignTaskSchema = z.object({
    params: getTaskParamsSchema.shape.params,
    body: z.object({
        assignedToId: z
            .uuid('Invalid assignee User ID format')
            .nullable(), // null = unassign
    }),
});

// ==========================================
// 2. Inferred DTO Types
// ==========================================

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>['body'];
export type TaskParamsInput = z.infer<typeof getTaskParamsSchema>['params'];
export type AssignTaskInput = z.infer<typeof assignTaskSchema>['body'];

// ==========================================
// 3. Centralized OpenAPI / Swagger Documentation
// ==========================================

registry.registerPath({
    method: 'post',
    path: '/api/tasks',
    tags: ['Tasks'],
    summary: 'Create a task',
    security: [{ bearerAuth: [] }],
    description:
        'Accepts application/json OR multipart/form-data with a `data` JSON part and optional `attachments` files (create-with-attachments in one request). The creator is derived from the bearer token.',
    request: {
        body: {
            content: {
                'application/json': { schema: createTaskSchema.shape.body },
            },
        },
    },
    responses: {
        201: { description: 'Task created' },
        400: { description: 'Input validation failure' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/tasks',
    tags: ['Tasks'],
    summary: 'List all tasks',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { description: 'Task list with creator context' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/tasks/{id}',
    tags: ['Tasks'],
    summary: 'Get a single task by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: getTaskParamsSchema.shape.params,
    },
    responses: {
        200: { description: 'Task found' },
        404: { description: 'Task not found' },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/api/tasks/{id}/assign',
    tags: ['Tasks'],
    summary: 'Assign or unassign a user to a task',
    security: [{ bearerAuth: [] }],
    description:
        'Assigns a user (or clears assignment with null). The assignee receives an email notification via the background worker.',
    request: {
        params: getTaskParamsSchema.shape.params,
        body: {
            content: {
                'application/json': { schema: assignTaskSchema.shape.body },
            },
        },
    },
    responses: {
        200: { description: 'Assignment updated' },
        400: { description: 'Workflow rule violated' },
        404: { description: 'Task or assignee not found' },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/api/tasks/{id}/status',
    tags: ['Tasks'],
    summary: 'Transition a task status',
    security: [{ bearerAuth: [] }],
    description:
        'Enforces workflow rules: DONE is immutable; PROCESSING/PROCESSED require an assignee.',
    request: {
        params: updateTaskStatusSchema.shape.params,
        body: {
            content: {
                'application/json': { schema: updateTaskStatusSchema.shape.body },
            },
        },
    },
    responses: {
        200: { description: 'Status changed' },
        400: { description: 'Workflow rule violated' },
        404: { description: 'Task not found' },
    },
});
