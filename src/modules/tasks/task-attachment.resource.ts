import { TaskAttachment } from '@generated/prisma/client';

export interface TaskAttachmentResponse {
    id: string;
    taskId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    downloadUrl: string;
    createdAt: string;
}

export const taskAttachmentResource = {
    single(attachment: TaskAttachment): TaskAttachmentResponse {
        return {
            id: attachment.id,
            taskId: attachment.taskId,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            // storageKey stays internal — clients use the scoped, authenticated URL
            downloadUrl: `/api/tasks/${attachment.taskId}/attachments/${attachment.id}/download`,
            createdAt: attachment.createdAt.toISOString(),
        };
    },

    collection(attachments: TaskAttachment[]): TaskAttachmentResponse[] {
        return attachments.map((attachment) => this.single(attachment));
    },
};
