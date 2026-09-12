import { AppError } from '@common/errors/AppError';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { assertMinimumRole } from './authorization';

export class DeleteOrganizationUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
    ) {}

    async execute(input: { orgId: string; actorId: string }): Promise<void> {
        const membership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.actorId,
        );
        if (!membership) {
            throw new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER');
        }
        assertMinimumRole(membership, 'OWNER');

        await this.organizationRepository.delete(input.orgId);
    }
}
