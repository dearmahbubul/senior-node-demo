import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { assertMinimumRole } from './authorization';

export class RemoveMemberUseCase {
    constructor(private readonly membershipRepository: OrganizationMembershipRepositoryPort) {}

    async execute(input: { orgId: string; actorId: string; userId: string }): Promise<void> {
        const actorMembership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.actorId,
        );
        if (!actorMembership) {
            throw new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER');
        }

        const targetMembership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.userId,
        );
        if (!targetMembership) {
            throw new NotFoundError('Member not found.', 'MEMBER_NOT_FOUND');
        }

        const isSelf = input.userId === input.actorId;
        if (isSelf) {
            // A member may leave on their own, but never as the last OWNER.
            await this.assertNotLastOwner(input.orgId, targetMembership.role);
        } else {
            assertMinimumRole(actorMembership, 'OWNER');
            if (targetMembership.role === 'OWNER') {
                await this.assertNotLastOwner(input.orgId, 'OWNER');
            }
        }

        await this.membershipRepository.deleteById(targetMembership.id);
    }

    private async assertNotLastOwner(orgId: string, role: string): Promise<void> {
        if (role !== 'OWNER') return;
        const owners = (await this.membershipRepository.listByOrganization(orgId)).filter(
            (m) => m.role === 'OWNER',
        );
        if (owners.length <= 1) {
            throw new AppError(409, 'An organization must keep at least one OWNER.', 'LAST_OWNER');
        }
    }
}
