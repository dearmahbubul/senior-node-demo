import { Router } from 'express';
import { resolveTenant } from '@common/middleware/resolveTenant';
import userRoutes from '@modules/users/user.routes';
import authRoutes from '@modules/auth/auth.routes';
import taskRoutes from '@modules/tasks/task.routes';
import organizationRoutes from '@modules/organization-management/interfaces/http/organization.routes';

const router = Router();

// Host-based tenancy: resolves the Host header to an organization (custom
// domain first, then {subdomain}.{APP_BASE_HOST}) and stashes it on
// res.locals.organizationId. Tolerant in dev (localhost).
router.use(resolveTenant);

router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);
router.use('/organizations', organizationRoutes);

export default router;
