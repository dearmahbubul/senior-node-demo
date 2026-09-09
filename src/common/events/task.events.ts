import { randomUUID } from 'node:crypto';
import { QUEUE_NAMES, publishToQueue } from '@common/queue/rabbitmq';
import { logger } from '@common/logger';
import type { TaskAssignedPayload } from '@common/mail/templates/task-assigned';

export interface EventEnvelope<T> {
    eventId: string;
    type: string;
    occurredAt: string;
    retryCount: number;
    data: T;
}

/**
 * Publishes AFTER the DB write has succeeded (call sites are post-commit).
 * The queue is durable and messages persistent — RabbitMQ survives broker
 * restarts, so a notification is never lost to a deploy.
 */
export async function emitTaskAssigned(payload: TaskAssignedPayload): Promise<void> {
    const envelope: EventEnvelope<TaskAssignedPayload> = {
        eventId: randomUUID(),
        type: 'task.assigned',
        occurredAt: new Date().toISOString(),
        retryCount: 0,
        data: payload,
    };

    try {
        await publishToQueue(QUEUE_NAMES.TASK_ASSIGNMENT, envelope);
        logger.info(
            { eventId: envelope.eventId, taskId: payload.taskId },
            'task.assigned event published',
        );
    } catch (err) {
        // Never fail the HTTP request because the notification queue hiccuped —
        // but make it loud enough for alerting.
        logger.error({ err, taskId: payload.taskId }, 'Failed to publish task.assigned event');
    }
}
