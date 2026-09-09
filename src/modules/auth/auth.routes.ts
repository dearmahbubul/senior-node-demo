import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '@common/middleware/validateRequest';
import { authenticate } from '@common/middleware/authenticate';
import { loginSchema } from './auth.validator';
import { loginRateLimiter } from '@common/middleware/rateLimiter';

const router = Router();

router.post('/login', loginRateLimiter, validateRequest(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);

export default router;
