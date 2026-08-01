import amqp, { type ChannelModel, type Channel } from 'amqplib';
import { logger } from '@common/logger';
import { env } from '@config/env';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export const QUEUE_NAMES = {
    TASK_ASSIGNMENT: 'task.assignment.notify',
} as const;

export async function connectQueue(): Promise<Channel> {
    if (channel) return channel;

    connection = await amqp.connect(env.rabbitmqUrl);
    channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAMES.TASK_ASSIGNMENT, { durable: true });

    connection.on('error', (err) => {
        logger.error({ err }, 'RabbitMQ connection error');
    });

    connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        channel = null;
        connection = null;
    });

    logger.info('Connected to RabbitMQ');
    return channel;
}

export async function publishToQueue(queueName: string, payload: unknown): Promise<void> {
    const ch = await connectQueue();
    const message = Buffer.from(JSON.stringify(payload));
    ch.sendToQueue(queueName, message, { persistent: true });
}