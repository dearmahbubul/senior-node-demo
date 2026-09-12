import { Request, Response } from 'express';
import { ApiResponse } from '@common/types/response';
import { asyncHandler } from '@common/utils/asyncHandler';
import {
    updateSubdomainUseCase,
    requestCustomDomainUseCase,
    verifyCustomDomainUseCase,
    removeCustomDomainUseCase,
} from '../../composition';
import { domainResource } from './domain.resource';
import { OrgIdParamsDto } from './organization.validator';
import { RequestCustomDomainDto, UpdateSubdomainDto } from './domain.validator';

export const domainController = {
    updateSubdomain: asyncHandler(
        async (
            req: Request<OrgIdParamsDto, {}, UpdateSubdomainDto>,
            res: Response<ApiResponse>,
        ) => {
            const actorId = req.user!.sub;
            const organization = await updateSubdomainUseCase.execute({
                orgId: req.params.orgId,
                actorId,
                subdomain: req.body.subdomain,
            });

            res.status(200).json({
                success: true,
                message: 'Subdomain updated successfully',
                data: domainResource.subdomainChanged(organization),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    requestCustomDomain: asyncHandler(
        async (
            req: Request<OrgIdParamsDto, {}, RequestCustomDomainDto>,
            res: Response<ApiResponse>,
        ) => {
            const actorId = req.user!.sub;
            const result = await requestCustomDomainUseCase.execute({
                orgId: req.params.orgId,
                actorId,
                domain: req.body.domain,
            });

            res.status(200).json({
                success: true,
                message: 'Custom domain pending verification. Publish the DNS TXT record below.',
                data: domainResource.customDomainRequested(result),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    verifyCustomDomain: asyncHandler(
        async (req: Request<OrgIdParamsDto>, res: Response<ApiResponse>) => {
            const actorId = req.user!.sub;
            const result = await verifyCustomDomainUseCase.execute({
                orgId: req.params.orgId,
                actorId,
            });

            res.status(200).json({
                success: true,
                message: 'Custom domain verified and activated',
                data: domainResource.customDomainVerified(result),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    removeCustomDomain: asyncHandler(
        async (req: Request<OrgIdParamsDto>, res: Response<ApiResponse>) => {
            const actorId = req.user!.sub;
            const organization = await removeCustomDomainUseCase.execute({
                orgId: req.params.orgId,
                actorId,
            });

            res.status(200).json({
                success: true,
                message: 'Custom domain removed. The tenant reverts to its subdomain.',
                data: domainResource.customDomainRemoved(organization),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),
};
