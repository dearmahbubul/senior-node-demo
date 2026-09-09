import { z } from 'zod';
import { registry } from '@common/openapi/registry';

// ==========================================
// 1. Zod v4 Schemas
// ==========================================

const taskIdParams = z.object({
    params: z.object({
        taskId: z.uuid('Invalid task ID format'),
    }),
});

/** Params-only schema shared by list + upload endpoints. */
export const listTaskAttachmentsSchema = taskIdParams;

export const taskAttachmentParamsSchema = z.object({
    params: z.object({
        taskId: z.uuid('Invalid task ID format'),
        id: z.uuid('Invalid attachment ID format'),
    }),
});

export const updateTaskAttachmentSchema = z.object({
    params: taskAttachmentParamsSchema.shape.params,
    // Metadata like size/mimeType is intrinsic to the stored bytes — only the
    // display name may be edited by clients.
    body: z.object({
        fileName: z.string().trim().min(1, 'File name cannot be empty').max(255),
    }),
});

// ==========================================
// 2. Inferred DTO Types
// ==========================================

export type TaskIdParams = z.infer<typeof taskIdParams>['params'];
export type TaskAttachmentParams = z.infer<typeof taskAttachmentParamsSchema>['params'];
export type UpdateTaskAttachmentDto = z.infer<typeof updateTaskAttachmentSchema>['body'];

// ==========================================
// 3. OpenAPI Registration
// ==========================================

registry.registerPath({
    method: 'post',
    path: '/api/tasks/{taskId}/attachments',
    tags: ['Task Attachments'],
    summary: 'Upload one or more attachments to a task',
    security: [{ bearerAuth: [] }],
    request: {
        params: taskIdParams.shape.params,
        body: {
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                        properties: {
                            attachments: {
                                type: 'array',
                                items: { type: 'string', format: 'binary' },
                            },
                        },
                        required: ['attachments'],
                    },
                },
            },
        },
    },
    responses: {
        201: { description: 'Attachments stored' },
        400: { description: 'Upload rejected (type/size/count)' },
        404: { description: 'Task not found' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/tasks/{taskId}/attachments',
    tags: ['Task Attachments'],
    summary: 'List all attachments of a task',
    security: [{ bearerAuth: [] }],
    request: { params: taskIdParams.shape.params },
    responses: {
        200: { description: 'Attachment list' },
        404: { description: 'Task not found' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/tasks/{taskId}/attachments/{id}/download',
    tags: ['Task Attachments'],
    summary: 'Download an attachment',
    security: [{ bearerAuth: [] }],
    request: { params: taskAttachmentParamsSchema.shape.params },
    responses: { 200: { description: 'File stream' }, 404: { description: 'Not found' } },
});

registry.registerPath({
    method: 'patch',
    path: '/api/tasks/{taskId}/attachments/{id}',
    tags: ['Task Attachments'],
    summary: 'Rename an attachment',
    security: [{ bearerAuth: [] }],
    request: {
        params: taskAttachmentParamsSchema.shape.params,
        body: {
            content: { 'application/json': { schema: updateTaskAttachmentSchema.shape.body } },
        },
    },
    responses: {
        200: { description: 'Attachment renamed' },
        404: { description: 'Task or attachment not found' },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/tasks/{taskId}/attachments/{id}',
    tags: ['Task Attachments'],
    summary: 'Delete an attachment (removes the stored file too)',
    security: [{ bearerAuth: [] }],
    request: { params: taskAttachmentParamsSchema.shape.params },
    responses: {
        200: { description: 'Attachment deleted' },
        404: { description: 'Task or attachment not found' },
    },
});
