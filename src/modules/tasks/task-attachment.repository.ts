import { prisma } from '@db/client';
import { TaskAttachment, Prisma } from '@generated/prisma/client';

export const taskAttachmentRepository = {
    create: (data: Prisma.TaskAttachmentUncheckedCreateInput): Promise<TaskAttachment> =>
        prisma.taskAttachment.create({ data }),

    listByTaskId: (taskId: string): Promise<TaskAttachment[]> =>
        prisma.taskAttachment.findMany({
            where: { taskId },
            orderBy: { createdAt: 'desc' },
        }),

    /**
     * Scoped lookup: the attachment MUST belong to the given task.
     * Prevents cross-parent access via crafted URLs.
     */
    findByIdAndTaskId: (id: string, taskId: string): Promise<TaskAttachment | null> =>
        prisma.taskAttachment.findFirst({ where: { id, taskId } }),

    update: (
        id: string,
        data: Prisma.TaskAttachmentUncheckedUpdateInput,
    ): Promise<TaskAttachment> => prisma.taskAttachment.update({ where: { id }, data }),

    delete: (id: string): Promise<TaskAttachment> =>
        prisma.taskAttachment.delete({ where: { id } }),
};
