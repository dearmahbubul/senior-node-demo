import { Router } from 'express';
import { taskController } from './task.controller';
import { getTaskParamsSchema, assignTaskSchema, updateTaskStatusSchema } from './task.validator';
import { validateRequest } from '@common/middleware/validateRequest';
import { authenticate } from '@common/middleware/authenticate';
import { handleUpload } from '@common/middleware/upload';
import taskAttachmentRoutes from './task-attachment.routes';

const router = Router();
router.use(authenticate);

// Nested attachment resource; each child route validates :taskId itself
router.use('/:taskId/attachments', taskAttachmentRoutes);

router
    .route('/')
    // handleUpload is a no-op pass-through for JSON bodies; the controller
    // detects multipart vs json and validates accordingly
    .post(handleUpload('attachments'), taskController.create)
    .get(taskController.list);

router.route('/:id').get(validateRequest(getTaskParamsSchema), taskController.getById);

router.patch(
    '/:id/assign',
    validateRequest(assignTaskSchema),
    taskController.assign,
);

router
    .route('/:id/status')
    .patch(validateRequest(updateTaskStatusSchema), taskController.updateStatus);

export default router;
