import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { Organization } from '../domain/entities/organization.entity';
import { OrganizationMembership } from '../domain/entities/organization-membership.entity';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';

export interface GetOrganizationResult {
    organization: Organization;
    membership: OrganizationMembership;
}

export class GetOrganizationUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
    ) {}

    async execute(input: { orgId: string; actorId: string }): Promise<GetOrganizationResult> {
        const organization = await this.organizationRepository.findById(input.orgId);
        if (!organization) {
            throw new NotFoundError('Organization not found.', 'ORGANIZATION_NOT_FOUND');
        }

        const membership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.actorId,
        );
        if (!membership) {
            throw new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER');
        }

        return { organization, membership };
    }
}
