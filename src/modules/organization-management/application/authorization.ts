import { AppError } from '@common/errors/AppError';
import { hasMinimumRole, OrgRole } from '../domain/value-objects/org-role.vo';
import { OrganizationMembership } from '../domain/entities/organization-membership.entity';

/**
 * Re-validation helper used by write use cases (defense-in-depth below the
 * `authorizeMembership` middleware): VIEWER is read-only, and role-gated
 * operations must fail inside the use case too.
 */
export function assertMinimumRole(
    membership: OrganizationMembership,
    minimum: OrgRole,
    message = 'You do not have permission to perform this action.',
): void {
    if (!hasMinimumRole(membership.role, minimum)) {
        throw new AppError(403, message, 'INSUFFICIENT_ROLE', { required: minimum });
    }
}

export function assertMembership(
    membership: OrganizationMembership | null,
): asserts membership is OrganizationMembership {
    if (!membership) {
        throw new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER');
    }
}
