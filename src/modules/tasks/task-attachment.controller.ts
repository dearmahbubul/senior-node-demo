import { Request, Response } from 'express';
import { taskAttachmentService } from './task-attachment.service';
import { asyncHandler } from '@common/utils/asyncHandler';
import {
    TaskAttachmentParams,
    TaskIdParams,
    UpdateTaskAttachmentDto,
} from './task-attachment.validator';
import { ApiResponse } from '@common/types/response';
import { taskAttachmentResource } from './task-attachment.resource';
import { getUploadedFiles } from '@common/middleware/upload';

export const taskAttachmentController = {
    create: asyncHandler(async (req: Request<TaskIdParams>, res: Response<ApiResponse>) => {
        const files = getUploadedFiles(req);
        const attachments = await taskAttachmentService.createAttachments(
            req.params.taskId,
            req.user!.sub,
            files,
        );

        res.status(201).json({
            success: true,
            message: `${attachments.length} attachment(s) stored successfully`,
            data: taskAttachmentResource.collection(attachments),
            meta: { timestamp: new Date().toISOString() },
        });
    }),

    list: asyncHandler(async (req: Request<TaskIdParams>, res: Response<ApiResponse>) => {
        const attachments = await taskAttachmentService.listAttachments(req.params.taskId);

        res.status(200).json({
            success: true,
            message: 'Task attachments retrieved successfully',
            data: taskAttachmentResource.collection(attachments),
            meta: {
                count: attachments.length,
                timestamp: new Date().toISOString(),
            },
        });
    }),

    download: asyncHandler(async (req: Request<TaskAttachmentParams>, res: Response) => {
        const { attachment, body } = await taskAttachmentService.downloadAttachment(
            req.params.taskId,
            req.params.id,
        );

        res.status(200)
            .setHeader('content-type', attachment.mimeType)
            .setHeader('content-length', body.byteLength)
            .setHeader(
                'content-disposition',
                `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
            )
            .send(body);
    }),

    update: asyncHandler(
        async (
            req: Request<TaskAttachmentParams, {}, UpdateTaskAttachmentDto>,
            res: Response<ApiResponse>,
        ) => {
            const attachment = await taskAttachmentService.updateAttachment(
                req.params.taskId,
                req.params.id,
                req.body,
            );

            res.status(200).json({
                success: true,
                message: 'Task attachment updated successfully',
                data: taskAttachmentResource.single(attachment),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    delete: asyncHandler(async (req: Request<TaskAttachmentParams>, res: Response<ApiResponse>) => {
        await taskAttachmentService.deleteAttachment(req.params.taskId, req.params.id);

        res.status(200).json({
            success: true,
            message: 'Task attachment deleted successfully',
            meta: { timestamp: new Date().toISOString() },
        });
    }),
};
