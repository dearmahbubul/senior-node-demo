import { Router } from 'express';
import { taskAttachmentController } from './task-attachment.controller';
import { validateRequest } from '@common/middleware/validateRequest';
import {
    listTaskAttachmentsSchema,
    taskAttachmentParamsSchema,
    updateTaskAttachmentSchema,
} from './task-attachment.validator';
import { authenticate } from '@common/middleware/authenticate';
import { handleUpload } from '@common/middleware/upload';

// mergeParams: true forwards :taskId captured by the parent task router
const router = Router({ mergeParams: true });

router.use(authenticate);

// Uploads: multer consumes the multipart stream first, then params are validated
router.post(
    '/',
    handleUpload('attachments'),
    validateRequest(listTaskAttachmentsSchema),
    taskAttachmentController.create,
);
router.get('/', validateRequest(listTaskAttachmentsSchema), taskAttachmentController.list);

// NOTE: declared before '/:id' so 'download' is never captured as an id segment
router.get(
    '/:id/download',
    validateRequest(taskAttachmentParamsSchema),
    taskAttachmentController.download,
);

router
    .route('/:id')
    .patch(validateRequest(updateTaskAttachmentSchema), taskAttachmentController.update)
    .delete(validateRequest(taskAttachmentParamsSchema), taskAttachmentController.delete);

export default router;
