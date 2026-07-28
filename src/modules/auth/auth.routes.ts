import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '@common/middleware/validate';
import { authenticate } from '@common/middleware/authenticate';
import { loginSchema } from './auth.validator';

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);

export default router;