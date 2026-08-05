import { Router } from 'express';
import { taskController } from './task.controller';
import { validateRequest } from '@common/middleware/validateRequest';
import { createTaskSchema, getTaskParamsSchema, updateTaskStatusSchema } from './task.validator';

const router = Router();

router
    .route('/')
    .post(validateRequest(createTaskSchema), taskController.create)
    .get(taskController.list);

router.route('/:id').get(validateRequest(getTaskParamsSchema), taskController.getById);

router
    .route('/:id/status')
    .patch(validateRequest(updateTaskStatusSchema), taskController.updateStatus);

export default router;
