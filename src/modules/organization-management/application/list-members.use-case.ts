import { AppError } from '@common/errors/AppError';
import { OrganizationMembership } from '../domain/entities/organization-membership.entity';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';

export class ListMembersUseCase {
    constructor(private readonly membershipRepository: OrganizationMembershipRepositoryPort) {}

    async execute(input: { orgId: string; actorId: string }): Promise<OrganizationMembership[]> {
        const actorMembership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.actorId,
        );
        if (!actorMembership) {
            throw new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER');
        }
        return this.membershipRepository.listByOrganization(input.orgId);
    }
}
