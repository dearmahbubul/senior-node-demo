import { taskRepository } from './task.repository';
import { CreateTaskInput, UpdateTaskStatusInput } from './task.validator';
import { AppError } from '@common/errors/AppError';
import { TaskStatus } from '../../generated/prisma/enums';

export const taskService = {
    /**
     * Prepares incoming inputs, forces business defaults, and triggers creation.
     */
    async createTask(input: CreateTaskInput) {
        const taskPayload = {
            title: input.title,
            description: input.description ?? null,
            userId: input.userId,
            assignedToId: input.assignedToId ?? null,
            status: TaskStatus.PENDING, // Core system design rule
        };

        // return taskRepository.create(taskPayload);

        // Returns the task along with user and assignee details immediately
        return taskRepository.createWithRelations(taskPayload);
    },

    /**
     * Fetches an populated task. Throws a fast-fail 404 error if missing.
     */
    async getTaskById(id: string) {
        const task = await taskRepository.findByIdWithRelations(id);
        if (!task) {
            throw new AppError(
                404,
                `Task resource with ID ${id} does not exist.`,
                'TASK_NOT_FOUND',
            );
        }
        return task;
    },

    /**
     * Aggregates a catalog of active tasks for dashboard feeds.
     */
    async listTasks() {
        return taskRepository.listAll();
    },

    /**
     * Modifies the operational owner assigned to handle a task tracking stream.
     */
    async assignTask(id: string, assigneeId: string | null) {
        const task = await taskRepository.findById(id);
        if (!task) {
            throw new AppError(
                404,
                'Task resource missing for allocation update.',
                'TASK_NOT_FOUND',
            );
        }

        // Guard rule: Blocks modifications to completed tasks
        if (task.status === TaskStatus.DONE) {
            throw new AppError(
                400,
                'Cannot transfer ownership of a completed task.',
                'INVALID_WORKFLOW_STATE',
            );
        }

        const updatePayload = {
            assignedToId: assigneeId,
            // Shifts task state to PROCESSING if a pending task receives an active handler assignment
            status:
                task.status === TaskStatus.PENDING && assigneeId
                    ? TaskStatus.PROCESSING
                    : task.status,
        };

        return taskRepository.update(id, updatePayload);
    },

    /**
     * Shifts pipeline checkpoints inside your TaskStatus enum engine state.
     */
    async updateTaskStatus(id: string, data: UpdateTaskStatusInput) {
        const task = await taskRepository.findById(id);
        if (!task) {
            throw new AppError(
                404,
                'Task resource missing for status transition.',
                'TASK_NOT_FOUND',
            );
        }

        // Guard rule: Block shifting closed items backwards
        if (task.status === TaskStatus.DONE && data.status !== TaskStatus.DONE) {
            throw new AppError(
                400,
                'Completed tasks cannot be reopened or moved back.',
                'TASK_IMMUTABLE',
            );
        }

        // Guard rule: Block execution if status advances to active workload phases without an assignee
        if (
            !task.assignedToId &&
            (data.status === TaskStatus.PROCESSING || data.status === TaskStatus.PROCESSED)
        ) {
            throw new AppError(
                400,
                'Tasks cannot enter production pipelines without an assigned owner.',
                'MISSING_ASSIGNEE',
            );
        }

        return taskRepository.update(id, { status: data.status as TaskStatus });
    },

    /**
     * Cleans up database traces by deleting a task record after running a verification check.
     */
    async deleteTask(id: string) {
        const task = await taskRepository.findById(id);
        if (!task) {
            throw new AppError(404, 'Task resource missing for erasure process.', 'TASK_NOT_FOUND');
        }

        return taskRepository.delete(id);
    },
};
