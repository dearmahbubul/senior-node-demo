import { env } from '@config/env';

export interface TaskAssignedPayload {
    taskId: string;
    taskTitle: string;
    assignedToId: string;
    assignerName: string | null;
}

export function buildTaskAssignedEmail(payload: TaskAssignedPayload): {
    subject: string;
    html: string;
    text: string;
} {
    const taskUrl = `${env.appUrl}/tasks/${payload.taskId}`;
    const assigner = payload.assignerName ?? 'A teammate';

    const subject = `You have been assigned a task: ${payload.taskTitle}`;

    const text = [
        `Hi,`,
        ``,
        `${assigner} assigned you a new task: "${payload.taskTitle}".`,
        ``,
        `Open it here: ${taskUrl}`,
    ].join('\n');

    const html = `
<!doctype html>
<html>
  <body style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px;">
    <div style="max-width:520px;margin:auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
      <h2 style="margin-top:0;color:#111827">New task assignment</h2>
      <p style="color:#374151"><strong>${escapeHtml(assigner)}</strong> assigned you a task:</p>
      <p style="font-size:18px;color:#111827;background:#f3f4f6;padding:12px;border-radius:6px">
        ${escapeHtml(payload.taskTitle)}
      </p>
      <p style="margin:24px 0">
        <a href="${taskUrl}" style="background:#2563eb;color:#fff;text-decoration:none;
           padding:10px 18px;border-radius:6px;display:inline-block">Open task</a>
      </p>
      <p style="color:#9ca3af;font-size:12px">You received this because you are assigned to this task.</p>
    </div>
  </body>
</html>`;

    return { subject, html, text };
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
