import { Router } from 'express';
import { domainController } from './domain.controller';
import { authenticate } from '@common/middleware/authenticate';
import { authorizeMembership } from '@common/middleware/authorizeMembership';
import { validateRequest } from '@common/middleware/validateRequest';
import {
    requestCustomDomainSchema,
    updateSubdomainSchema,
    verifyCustomDomainParamsSchema,
} from './domain.validator';
import { orgIdParamsSchema } from './organization.validator';

const router = Router();

router.patch(
    '/:orgId/domain',
    authenticate,
    authorizeMembership({ minRole: 'ADMIN' }),
    validateRequest(updateSubdomainSchema),
    domainController.updateSubdomain,
);

router.post(
    '/:orgId/custom-domain',
    authenticate,
    authorizeMembership({ minRole: 'ADMIN' }),
    validateRequest(requestCustomDomainSchema),
    domainController.requestCustomDomain,
);

router.post(
    '/:orgId/custom-domain/verify',
    authenticate,
    authorizeMembership({ minRole: 'ADMIN' }),
    validateRequest(verifyCustomDomainParamsSchema),
    domainController.verifyCustomDomain,
);

router.delete(
    '/:orgId/custom-domain',
    authenticate,
    authorizeMembership({ minRole: 'ADMIN' }),
    validateRequest(orgIdParamsSchema),
    domainController.removeCustomDomain,
);

export default router;
