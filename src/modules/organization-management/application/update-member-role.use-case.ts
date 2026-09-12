import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { OrganizationMembership } from '../domain/entities/organization-membership.entity';
import { OrgRole, isOrgRole } from '../domain/value-objects/org-role.vo';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { assertMinimumRole } from './authorization';

export interface UpdateMemberRoleInput {
    orgId: string;
    actorId: string;
    userId: string;
    role: OrgRole;
}

export class UpdateMemberRoleUseCase {
    constructor(private readonly membershipRepository: OrganizationMembershipRepositoryPort) {}

    async execute(input: UpdateMemberRoleInput): Promise<OrganizationMembership> {
        if (!isOrgRole(input.role)) {
            throw new AppError(
                400,
                `"${input.role}" is not a valid organization role.`,
                'INVALID_ROLE',
            );
        }

        const actorMembership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.actorId,
        );
        if (!actorMembership) {
            throw new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER');
        }
        assertMinimumRole(actorMembership, 'ADMIN');

        const targetMembership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.userId,
        );
        if (!targetMembership) {
            throw new NotFoundError('Member not found.', 'MEMBER_NOT_FOUND');
        }

        if (targetMembership.role === 'OWNER' && input.role !== 'OWNER') {
            if (actorMembership.role !== 'OWNER') {
                throw new AppError(
                    403,
                    'Only an OWNER can demote another OWNER.',
                    'INSUFFICIENT_ROLE',
                );
            }
            if (input.userId === input.actorId) {
                throw new AppError(
                    409,
                    'You cannot demote yourself from OWNER.',
                    'CANNOT_DEMOTE_OWNER',
                );
            }
            const ownerCount = (
                await this.membershipRepository.listByOrganization(input.orgId)
            ).filter((m) => m.role === 'OWNER').length;
            if (ownerCount <= 1) {
                throw new AppError(
                    409,
                    'An organization must keep at least one OWNER.',
                    'LAST_OWNER',
                );
            }
        }

        if (targetMembership.role === input.role) {
            return targetMembership;
        }

        targetMembership.changeRole(input.role);
        await this.membershipRepository.save(targetMembership);
        return targetMembership;
    }
}
