import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { Organization } from '../domain/entities/organization.entity';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { OrganizationEventPublisherPort } from '../domain/ports/organization-event-publisher.port';
import { assertMinimumRole } from './authorization';

export interface UpdateSubdomainInput {
    orgId: string;
    actorId: string;
    subdomain: string;
}

export class UpdateSubdomainUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
        private readonly eventPublisher: OrganizationEventPublisherPort,
    ) {}

    async execute(input: UpdateSubdomainInput): Promise<Organization> {
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

        // Uniqueness is enforced here (and defensively by the unique constraint
        // in the repository adapter — races surface as 409 there as well).
        const existing = await this.organizationRepository.findBySubdomain(input.subdomain);
        if (existing && existing.id !== organization.id) {
            throw new AppError(
                409,
                `The subdomain "${input.subdomain}" is already in use.`,
                'SUBDOMAIN_EXISTS',
            );
        }

        const event = organization.changeSubdomain(input.subdomain);
        await this.organizationRepository.save(organization);
        await this.eventPublisher.publish(event);

        return organization;
    }
}
