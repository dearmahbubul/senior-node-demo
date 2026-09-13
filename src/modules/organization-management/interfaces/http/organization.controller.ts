import { Request, Response } from 'express';
import { ApiResponse } from '@common/types/response';
import { asyncHandler } from '@common/utils/asyncHandler';
import {
    createOrganizationUseCase,
    getOrganizationUseCase,
    listOrganizationsUseCase,
    updateOrganizationUseCase,
    deleteOrganizationUseCase,
    addMemberUseCase,
    listMembersUseCase,
    updateMemberRoleUseCase,
    removeMemberUseCase,
    organizationQueries,
} from '../../composition';
import { organizationResource, membershipResource } from './organization.resource';
import {
    AddMemberDto,
    CreateOrganizationDto,
    MemberParamsDto,
    OrgIdParamsDto,
    UpdateMemberRoleDto,
    UpdateOrganizationDto,
} from './organization.validator';

export const organizationController = {
    create: asyncHandler(
        async (req: Request<{}, {}, CreateOrganizationDto>, res: Response<ApiResponse>) => {
            const actorId = req.user!.sub;
            const organization = await createOrganizationUseCase.execute({
                actorId,
                name: req.body.name,
                slug: req.body.slug,
            });

            res.status(201).json({
                success: true,
                message: 'Organization created successfully',
                data: organizationResource.single(organization, 'OWNER'),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    list: asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
        const actorId = req.user!.sub;
        const items = await listOrganizationsUseCase.execute({ actorId });

        res.status(200).json({
            success: true,
            message: 'Organizations fetched successfully',
            data: organizationResource.collection(items),
            meta: { timestamp: new Date().toISOString(), total: items.length },
        });
    }),

    getById: asyncHandler(async (req: Request<OrgIdParamsDto>, res: Response<ApiResponse>) => {
        const actorId = req.user!.sub;
        const { organization, membership } = await getOrganizationUseCase.execute({
            orgId: req.params.orgId,
            actorId,
        });

        res.status(200).json({
            success: true,
            message: 'Organization fetched successfully',
            data: organizationResource.single(organization, membership.role),
            meta: { timestamp: new Date().toISOString() },
        });
    }),

    update: asyncHandler(
        async (
            req: Request<OrgIdParamsDto, {}, UpdateOrganizationDto>,
            res: Response<ApiResponse>,
        ) => {
            const actorId = req.user!.sub;
            const organization = await updateOrganizationUseCase.execute({
                orgId: req.params.orgId,
                actorId,
                name: req.body.name,
                slug: req.body.slug,
            });

            const role = await organizationQueries.getMembershipRole(req.params.orgId, actorId);

            res.status(200).json({
                success: true,
                message: 'Organization updated successfully',
                data: organizationResource.single(organization, role),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    remove: asyncHandler(async (req: Request<OrgIdParamsDto>, res: Response<ApiResponse>) => {
        const actorId = req.user!.sub;
        await deleteOrganizationUseCase.execute({ orgId: req.params.orgId, actorId });

        res.status(200).json({
            success: true,
            message: 'Organization deleted successfully',
            data: null,
            meta: { timestamp: new Date().toISOString() },
        });
    }),

    addMember: asyncHandler(
        async (req: Request<OrgIdParamsDto, {}, AddMemberDto>, res: Response<ApiResponse>) => {
            const actorId = req.user!.sub;
            const membership = await addMemberUseCase.execute({
                orgId: req.params.orgId,
                actorId,
                userId: req.body.userId,
                role: req.body.role,
            });

            res.status(201).json({
                success: true,
                message: 'Member added successfully',
                data: membershipResource.single(membership),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    listMembers: asyncHandler(async (req: Request<OrgIdParamsDto>, res: Response<ApiResponse>) => {
        const actorId = req.user!.sub;
        const members = await listMembersUseCase.execute({
            orgId: req.params.orgId,
            actorId,
        });

        res.status(200).json({
            success: true,
            message: 'Members fetched successfully',
            data: membershipResource.collection(members),
            meta: { timestamp: new Date().toISOString(), total: members.length },
        });
    }),

    updateMemberRole: asyncHandler(
        async (
            req: Request<MemberParamsDto, {}, UpdateMemberRoleDto>,
            res: Response<ApiResponse>,
        ) => {
            const actorId = req.user!.sub;
            const membership = await updateMemberRoleUseCase.execute({
                orgId: req.params.orgId,
                actorId,
                userId: req.params.userId,
                role: req.body.role,
            });

            res.status(200).json({
                success: true,
                message: 'Member role updated successfully',
                data: membershipResource.single(membership),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    removeMember: asyncHandler(
        async (req: Request<MemberParamsDto>, res: Response<ApiResponse>) => {
            const actorId = req.user!.sub;
            await removeMemberUseCase.execute({
                orgId: req.params.orgId,
                actorId,
                userId: req.params.userId,
            });

            res.status(200).json({
                success: true,
                message: 'Member removed successfully',
                data: null,
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),
};
