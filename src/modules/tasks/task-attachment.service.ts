import { randomUUID } from 'node:crypto';
import { taskRepository } from './task.repository';
import { taskAttachmentRepository } from './task-attachment.repository';
import { UpdateTaskAttachmentDto } from './task-attachment.validator';
import { NotFoundError } from '@common/errors/NotFoundError';
import { AppError } from '@common/errors/AppError';
import { getStorage } from '@common/storage';
import { logger } from '@common/logger';

/** Extracts a safe extension like ".png" from the original client filename. */
function safeExtension(originalName: string): string {
    const ext = originalName.slice(originalName.lastIndexOf('.'));
    return /^\.[A-Za-z0-9]{1,10}$/.test(ext) ? ext.toLowerCase() : '';
}

export const taskAttachmentService = {
    async assertTaskExists(taskId: string) {
        const task = await taskRepository.findById(taskId);
        if (!task) {
            throw new NotFoundError(
                `Task resource with ID ${taskId} does not exist.`,
                'TASK_NOT_FOUND',
            );
        }
        return task;
    },

    /**
     * Stores each uploaded file, then persists its metadata.
     * If the DB insert fails after the file was saved, the stored file is
     * removed again (compensating action) so no orphan bytes accumulate.
     */
    async createAttachments(taskId: string, uploadedById: string, files: Express.Multer.File[]) {
        await this.assertTaskExists(taskId);
        if (files.length === 0) {
            throw new AppError(400, 'No files were provided.', 'NO_FILES_PROVIDED');
        }

        const storage = getStorage();
        const created = [];

        for (const file of files) {
            const key = `${randomUUID()}${safeExtension(file.originalname)}`;
            await storage.save(key, file.buffer, file.mimetype);

            try {
                const attachment = await taskAttachmentRepository.create({
                    taskId,
                    uploadedById,
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    storageKey: key,
                });
                created.push(attachment);
            } catch (err) {
                await storage.delete(key).catch(() => undefined);
                throw err;
            }
        }

        return created;
    },

    async listAttachments(taskId: string) {
        await this.assertTaskExists(taskId);
        return taskAttachmentRepository.listByTaskId(taskId);
    },

    async getAttachment(taskId: string, id: string) {
        const attachment = await taskAttachmentRepository.findByIdAndTaskId(id, taskId);
        if (!attachment) {
            throw new NotFoundError('Attachment not found for this task.', 'ATTACHMENT_NOT_FOUND');
        }
        return attachment;
    },

    /** Returns { attachment, body } ready for streaming by the controller. */
    async downloadAttachment(taskId: string, id: string) {
        const attachment = await this.getAttachment(taskId, id);
        const body = await getStorage().read(attachment.storageKey);
        return { attachment, body };
    },

    async updateAttachment(taskId: string, id: string, input: UpdateTaskAttachmentDto) {
        await this.getAttachment(taskId, id);
        return taskAttachmentRepository.update(id, { fileName: input.fileName });
    },

    /**
     * Deletes the DB row first, then best-effort removes the physical object.
     * A failed storage delete must not fail the request — it only leaves an
     * orphan to be swept later (logged for ops).
     */
    async deleteAttachment(taskId: string, id: string) {
        const attachment = await this.getAttachment(taskId, id);
        await taskAttachmentRepository.delete(attachment.id);
        await getStorage()
            .delete(attachment.storageKey)
            .catch((err) => {
                logger.warn(
                    { err, key: attachment.storageKey },
                    'Orphaned attachment file could not be deleted',
                );
            });
        return attachment;
    },
};
