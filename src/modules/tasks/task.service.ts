import { taskRepository } from './task.repository';
import { CreateTaskInput, UpdateTaskStatusInput } from './task.validator';
import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { TaskStatus } from '@generated/prisma/enums';
import { userRepository } from '@modules/users/user.repository';
import { emitTaskAssigned } from '@common/events/task.events';

export const taskService = {
    /**
     * Prepares incoming inputs, forces business defaults, and triggers creation.
     * The creator is injected server-side from the authenticated subject.
     * If the task is born already-assigned, the assignee notification is emitted.
     */
    async createTask(input: CreateTaskInput, creatorId: string) {
        if (input.assignedToId) {
            await this.assertAssigneeExists(input.assignedToId);
        }

        const task = await taskRepository.createWithRelations({
            title: input.title,
            description: input.description ?? null,
            userId: creatorId,
            assignedToId: input.assignedToId ?? null,
            status: TaskStatus.PENDING, // Core system design rule
        });

        if (input.assignedToId) {
            await emitTaskAssigned({
                taskId: task.id,
                taskTitle: task.title,
                assignedToId: input.assignedToId,
                assignerName: task.user?.name ?? null,
            });
        }

        return task;
    },

    /**
     * Fetches an populated task. Throws a fast-fail 404 error if missing.
     */
    async getTaskById(id: string) {
        const task = await taskRepository.findByIdWithRelations(id);
        if (!task) {
            throw new NotFoundError(
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
     * Emits a task.assigned event consumed by the notification worker.
     */
    async assignTask(id: string, assigneeId: string | null) {
        const task = await taskRepository.findById(id);
        if (!task) {
            throw new NotFoundError(
                'Task resource missing for allocation update.',
                'TASK_NOT_FOUND',
            );
        }

        if (assigneeId && task.assignedToId !== assigneeId) {
            await this.assertAssigneeExists(assigneeId);
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

        const updated = await taskRepository.update(id, updatePayload);

        // Notify only on a real (re-)assignment, not on unassignment
        if (assigneeId && assigneeId !== task.assignedToId) {
            await emitTaskAssigned({
                taskId: updated.id,
                taskTitle: updated.title,
                assignedToId: assigneeId,
                assignerName: null, // worker hydrates names from DB
            });
        }

        return updated;
    },

    async assertAssigneeExists(userId: string) {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new NotFoundError(`Assignee with ID ${userId} does not exist.`, 'USER_NOT_FOUND');
        }
        return user;
    },

    /**
     * Shifts pipeline checkpoints inside your TaskStatus enum engine state.
     */
    async updateTaskStatus(id: string, data: UpdateTaskStatusInput) {
        const task = await taskRepository.findById(id);
        if (!task) {
            throw new NotFoundError(
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
            throw new NotFoundError('Task resource missing for erasure process.', 'TASK_NOT_FOUND');
        }

        return taskRepository.delete(id);
    },
};
