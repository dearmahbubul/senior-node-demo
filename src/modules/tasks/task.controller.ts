import { Request, Response } from 'express';
import { taskService } from './task.service';
import { taskAttachmentService } from './task-attachment.service';
import { asyncHandler } from '@common/utils/asyncHandler';
import {
    createTaskBodySchema,
    CreateTaskInput,
    TaskParamsInput,
    UpdateTaskStatusInput,
} from './task.validator';
import { taskResource } from './task.resource';
import { taskAttachmentResource } from './task-attachment.resource';
import { getUploadedFiles } from '@common/middleware/upload';
import { ValidationError } from '@common/errors/ValidationError';
import { ApiResponse } from '@common/types/response';

function flattenZodIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
    return error.issues.reduce<Record<string, string>>((acc, issue) => {
        acc[issue.path.join('.')] = issue.message;
        return acc;
    }, {});
}

export const taskController = {
    /**
     * Dual-mode create:
     *  - application/json            -> plain task
     *  - multipart/form-data         -> `data` JSON part + optional `attachments` files
     * Multer has already parsed the multipart body by the time we run.
     */
    create: asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
        const files = getUploadedFiles(req);
        const isMultipart = (req.headers['content-type'] ?? '').includes('multipart/form-data');

        let input: Omit<CreateTaskInput, 'userId'>;
        if (isMultipart) {
            let raw: unknown;
            try {
                raw = JSON.parse(req.body.data ?? '{}');
            } catch {
                throw new ValidationError('The "data" part must contain valid JSON', {
                    data: 'Invalid JSON payload',
                });
            }
            const parsed = createTaskBodySchema.safeParse(raw);
            if (!parsed.success) {
                throw new ValidationError('Invalid task data', flattenZodIssues(parsed.error));
            }
            input = parsed.data;
        } else {
            const parsed = createTaskBodySchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError(
                    'Input validation failed',
                    flattenZodIssues(parsed.error),
                );
            }
            input = parsed.data;
        }

        // Creator identity ALWAYS comes from the verified token
        const task = await taskService.createTask(input, req.user!.sub);

        // Same-request attachments: stored under the freshly created task id
        if (files.length > 0) {
            await taskAttachmentService.createAttachments(task.id, req.user!.sub, files);
        }

        const detail = await taskService.getTaskById(task.id);
        const attachments =
            files.length > 0 ? await taskAttachmentService.listAttachments(task.id) : [];

        res.status(201).json({
            success: true,
            message: 'Task initialized and registered successfully',
            data: {
                ...taskResource.detail(detail),
                ...(files.length > 0 && {
                    attachments: taskAttachmentResource.collection(attachments),
                }),
            },
            meta: { timestamp: new Date().toISOString() },
        });
    }),

    getById: asyncHandler(async (req: Request<TaskParamsInput>, res: Response<ApiResponse>) => {
        const task = await taskService.getTaskById(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Task trace found',
            data: taskResource.detail(task),
            meta: { timestamp: new Date().toISOString() },
        });
    }),

    list: asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
        const tasks = await taskService.listTasks();

        res.status(200).json({
            success: true,
            message: 'Active tasks catalog synchronized',
            data: taskResource.collection(tasks),
            meta: {
                count: tasks.length,
                timestamp: new Date().toISOString(),
            },
        });
    }),

    assign: asyncHandler(
        async (
            req: Request<TaskParamsInput, {}, { assignedToId: string | null }>,
            res: Response<ApiResponse>,
        ) => {
            const updated = await taskService.assignTask(req.params.id, req.body.assignedToId);
            // repository.update() returns no relations; refetch for the full payload
            const detail = await taskService.getTaskById(updated.id);

            res.status(200).json({
                success: true,
                message: req.body.assignedToId
                    ? 'Task assigned; the assignee will be notified by email'
                    : 'Task assignment cleared',
                data: taskResource.detail(detail),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    updateStatus: asyncHandler(
        async (
            req: Request<TaskParamsInput, {}, UpdateTaskStatusInput>,
            res: Response<ApiResponse>,
        ) => {
            await taskService.updateTaskStatus(req.params.id, req.body);

            // Fetch fresh database details following status changes
            const updatedTask = await taskService.getTaskById(req.params.id);

            res.status(200).json({
                success: true,
                message: `Task pipeline shifted to ${req.body.status}`,
                data: taskResource.detail(updatedTask),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),
};
