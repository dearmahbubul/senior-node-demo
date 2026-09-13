import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { hasMinimumRole, OrgRole, organizationQueries } from '@modules/organization-management';

export interface AuthorizeMembershipOptions {
    /** Minimum role required for the route (defaults to any membership). */
    minRole?: OrgRole;
}

/**
 * Enforces that `req.params.orgId` belongs to the authenticated user's
 * organization and (optionally) that their role meets the route's minimum.
 * The single place that decides who may touch a tenant-scoped resource.
 */
export function authorizeMembership(options: AuthorizeMembershipOptions = {}) {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user?.sub;
            if (!userId) {
                return next(new AppError(401, 'Authentication required.', 'UNAUTHORIZED'));
            }

            const rawOrgId = req.params.orgId;
            const orgId = (typeof rawOrgId === 'string' ? rawOrgId : rawOrgId?.[0]) ?? '';
            const role = await organizationQueries.getMembershipRole(orgId, userId);

            if (!role) {
                return next(
                    new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER'),
                );
            }

            if (options.minRole && !hasMinimumRole(role, options.minRole)) {
                return next(
                    new AppError(
                        403,
                        'You do not have permission to perform this action.',
                        'INSUFFICIENT_ROLE',
                        { required: options.minRole },
                    ),
                );
            }

            return next();
        } catch (err) {
            return next(err);
        }
    };
}
