import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { Organization } from '../domain/entities/organization.entity';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { OrganizationEventPublisherPort } from '../domain/ports/organization-event-publisher.port';
import { assertMinimumRole } from './authorization';

export class RemoveCustomDomainUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
        private readonly eventPublisher: OrganizationEventPublisherPort,
    ) {}

    async execute(input: { orgId: string; actorId: string }): Promise<Organization> {
        const membership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.actorId,
        );
        if (!membership) {
            throw new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER');
        }
        assertMinimumRole(membership, 'ADMIN');

        const organization = await this.organizationRepository.findById(input.orgId);
        if (!organization) {
            throw new NotFoundError('Organization not found.', 'ORGANIZATION_NOT_FOUND');
        }

        const event = organization.removeCustomDomain();
        await this.organizationRepository.save(organization);
        await this.eventPublisher.publish(event);

        return organization;
    }
}
