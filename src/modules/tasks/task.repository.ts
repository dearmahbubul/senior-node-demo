import { prisma } from '@prisma/client';
import { Task, Prisma } from '../../generated/prisma/client';

// Standardized performance filter to block passwordHash column downloads at the DB level
const safeUserSelect = { select: { id: true, name: true, email: true } };

export const taskRepository = {
    /**
     * Drops a raw, pre-validated data object straight into the task table.
     */
    create: (data: Prisma.TaskUncheckedCreateInput): Promise<Task> => {
        return prisma.task.create({ data });
    },

    /**
     * Inserts a task and returns it with relations in a SINGLE database query.
     */
    createWithRelations: (data: Prisma.TaskUncheckedCreateInput) => {
        return prisma.task.create({
            data,
            include: {
                user: safeUserSelect,
                assignedTo: safeUserSelect,
            },
        });
    },

    /**
     * Locates a raw task record by its ID without fetching its relational data.
     */
    findById: (id: string): Promise<Task | null> => {
        return prisma.task.findUnique({ where: { id } });
    },

    /**
     * Resolves a task record alongside fully resolved User profiles for web/mobile UI views.
     */
    findByIdWithRelations: (id: string) => {
        return prisma.task.findUnique({
            where: { id },
            include: {
                user: safeUserSelect,
                assignedTo: safeUserSelect,
            },
        });
    },

    /**
     * Returns a complete index of tasks, including creator and assignee context.
     */
    listAll: () => {
        return prisma.task.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: safeUserSelect,
                assignedTo: safeUserSelect, // Added assignee to complement list mappings
            },
        });
    },

    /**
     * Updates partial parameters on a single task record.
     */
    update: (id: string, data: Prisma.TaskUncheckedUpdateInput): Promise<Task> => {
        return prisma.task.update({ where: { id }, data });
    },

    /**
     * Hard-deletes a task row from the table database.
     */
    delete: (id: string): Promise<Task> => {
        return prisma.task.delete({ where: { id } });
    },
};
