import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@common/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (transporter) return transporter;

    if (env.mail.host) {
        transporter = nodemailer.createTransport({
            host: env.mail.host,
            port: env.mail.port,
            secure: env.mail.port === 465,
            auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
        });
        logger.info(`Mail transport: SMTP ${env.mail.host}:${env.mail.port}`);
    } else {
        // Dev fallback: "sends" become structured logs — no infra required
        transporter = nodemailer.createTransport({ jsonTransport: true });
        logger.info('Mail transport: dev/json (emails are logged, not sent)');
    }
    return transporter;
}

export interface MailMessage {
    to: string;
    subject: string;
    html: string;
    text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
    if (!env.mail.host) {
        logger.info(
            { to: message.to, subject: message.subject },
            '[DEV MAIL] email rendered but not sent',
        );
        return;
    }

    await getTransporter().sendMail({
        from: env.mail.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
    });
}
