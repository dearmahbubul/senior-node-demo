import { Router } from 'express';
import userRoutes from '@modules/users/user.routes';
import authRoutes from '@modules/auth/auth.routes';
import taskRoutes from '@modules/tasks/task.routes';

const router = Router();
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);

export default router;