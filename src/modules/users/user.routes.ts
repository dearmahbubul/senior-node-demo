import { Router } from 'express';
import { userController } from './user.controller';
import { validate } from '../../common/middleware/validate';
import { createUserSchema } from './user.validator';
import { authenticate } from '@common/middleware/authenticate';

const router = Router();

router.post('/', authenticate, validate(createUserSchema), userController.create);
router.get('/:id', authenticate, userController.getById);

export default router;