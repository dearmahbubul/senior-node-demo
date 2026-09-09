import type { Channel, ConsumeMessage } from 'amqplib';
import { connectQueue, disconnectQueue, QUEUE_NAMES } from '@common/queue/rabbitmq';
import { logger } from '@common/logger';
import { prisma } from '@db/client';
import { sendMail } from '@common/mail/mailer';
import { buildTaskAssignedEmail, TaskAssignedPayload } from '@common/mail/templates/task-assigned';
import type { EventEnvelope } from '@common/events/task.events';

const MAX_RETRIES = 3;

/**
 * Notification worker — a SEPARATE process from the API.
 * Consumes task events and sends emails so HTTP responses never wait on SMTP.
 */
async function handleTaskAssigned(message: ConsumeMessage): Promise<void> {
    const channel = await getChannel();
    const envelope = parseEnvelope(message);
    if (!envelope) {
        // Malformed/poison message: never requeue forever
        logger.error({ raw: message.content.toString() }, 'Discarding malformed queue message');
        channel.ack(message);
        return;
    }

    const { eventId, retryCount, data } = envelope;
    logger.info({ eventId, taskId: data.taskId, attempt: retryCount + 1 }, 'Processing task.assigned');

    try {
        const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
        if (!assignee) {
            // Data-level dead letter: user vanished; retrying won't help
            logger.warn({ eventId, assignedToId: data.assignedToId }, 'Assignee no longer exists; dropping notification');
            channel.ack(message);
            return;
        }

        const email = buildTaskAssignedEmail({
            taskId: data.taskId,
            taskTitle: data.taskTitle,
            assignedToId: assignee.id,
            assignerName: data.assignerName,
        });

        await sendMail({ to: assignee.email, ...email });
        channel.ack(message);
        logger.info({ eventId, to: assignee.email }, 'Assignment notification sent');
    } catch (err) {
        if (retryCount + 1 >= MAX_RETRIES) {
            logger.error({ err, eventId, taskId: data.taskId }, 'Notification failed permanently (dead-lettered)');
            channel.ack(message); // plug in a real DLX here when needed
            return;
        }

        // Re-publish with incremented attempt count, then ack the original.
        // Avoids unbounded redelivery loops on persistent poison messages.
        logger.warn({ err, eventId, nextAttempt: retryCount + 2 }, 'Notification failed; requeueing for retry');
        channel.sendToQueue(
            QUEUE_NAMES.TASK_ASSIGNMENT,
            message.content,
            { persistent: true, headers: { retryCount: retryCount + 1 } },
        );
        channel.ack(message);
    }
}

function parseEnvelope(message: ConsumeMessage): EventEnvelope<TaskAssignedPayload> | null {
    try {
        const parsed = JSON.parse(message.content.toString());
        // Header retryCount (set by our retry path) wins over the body copy
        const headerRetry = Number(message.properties.headers?.retryCount ?? parsed.retryCount ?? 0);
        return { ...parsed, retryCount: headerRetry };
    } catch {
        return null;
    }
}

let channelPromise: Promise<Channel> | null = null;
async function getChannel(): Promise<Channel> {
    if (!channelPromise) channelPromise = connectQueue();
    return channelPromise;
}

async function main() {
    const channel = await getChannel();
    await channel.consume(QUEUE_NAMES.TASK_ASSIGNMENT, (msg) => {
        if (!msg) return;
        void handleTaskAssigned(msg).catch((err) => {
            logger.error({ err }, 'Worker handler crashed');
            channel.nack(msg, false, false); // don't loop a crashing message
        });
    });

    logger.info(`Notification worker listening on queue "${QUEUE_NAMES.TASK_ASSIGNMENT}"`);

    let shuttingDown = false;
    async function shutdown(signal: string) {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info(`${signal} received, worker shutting down gracefully`);
        await Promise.allSettled([disconnectQueue(), prisma.$disconnect()]);
        process.exit(0);
    }
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
    logger.error({ err }, 'Notification worker failed to start');
    process.exit(1);
});
