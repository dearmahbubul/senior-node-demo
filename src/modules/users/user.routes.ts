import { Router } from 'express';
import { userController } from './user.controller';
import { validateRequest } from '@common/middleware/validateRequest';
import { createUserSchema, getUserParamsSchema } from './user.validator';
import { authenticate } from '@common/middleware/authenticate';

const router = Router();

router.post('/', authenticate, validateRequest(createUserSchema), userController.create);
router.get('/:id', authenticate, validateRequest(getUserParamsSchema), userController.getById);

export default router;
