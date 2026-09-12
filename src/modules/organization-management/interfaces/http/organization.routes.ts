import { Router } from 'express';
import { organizationController } from './organization.controller';
import { authenticate } from '@common/middleware/authenticate';
import { authorizeMembership } from '@common/middleware/authorizeMembership';
import { validateRequest } from '@common/middleware/validateRequest';
import {
    addMemberSchema,
    createOrganizationSchema,
    memberParamsSchema,
    orgIdParamsSchema,
    updateMemberRoleSchema,
    updateOrganizationSchema,
} from './organization.validator';
import { default as domainRoutes } from './domain.routes';

const router = Router();

// Organization CRUD
router.post(
    '/',
    authenticate,
    validateRequest(createOrganizationSchema),
    organizationController.create,
);
router.get('/', authenticate, organizationController.list);
router.get(
    '/:orgId',
    authenticate,
    authorizeMembership(),
    validateRequest(orgIdParamsSchema),
    organizationController.getById,
);
router.patch(
    '/:orgId',
    authenticate,
    authorizeMembership({ minRole: 'ADMIN' }),
    validateRequest(updateOrganizationSchema),
    organizationController.update,
);
router.delete(
    '/:orgId',
    authenticate,
    authorizeMembership({ minRole: 'OWNER' }),
    validateRequest(orgIdParamsSchema),
    organizationController.remove,
);

// Membership
router.post(
    '/:orgId/members',
    authenticate,
    authorizeMembership({ minRole: 'ADMIN' }),
    validateRequest(addMemberSchema),
    organizationController.addMember,
);
router.get(
    '/:orgId/members',
    authenticate,
    authorizeMembership(),
    validateRequest(orgIdParamsSchema),
    organizationController.listMembers,
);
router.patch(
    '/:orgId/members/:userId',
    authenticate,
    authorizeMembership({ minRole: 'ADMIN' }),
    validateRequest(updateMemberRoleSchema),
    organizationController.updateMemberRole,
);
router.delete(
    '/:orgId/members/:userId',
    authenticate,
    authorizeMembership(),
    validateRequest(memberParamsSchema),
    organizationController.removeMember,
);

// Tenant domain endpoints (subdomain + custom domain)
router.use(domainRoutes);

export default router;
