import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { Organization } from '../domain/entities/organization.entity';
import { Slug } from '../domain/value-objects/slug.vo';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { assertMinimumRole } from './authorization';

export interface UpdateOrganizationInput {
    orgId: string;
    actorId: string;
    name?: string;
    slug?: string;
}

export class UpdateOrganizationUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
    ) {}

    async execute(input: UpdateOrganizationInput): Promise<Organization> {
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

        if (input.name !== undefined) {
            organization.updateName(input.name);
        }

        if (input.slug !== undefined) {
            const slug = Slug.create(input.slug);
            if (slug.value !== organization.slug) {
                const existing = await this.organizationRepository.findBySlug(slug.value);
                if (existing && existing.id !== organization.id) {
                    throw new AppError(
                        409,
                        `The slug "${slug.value}" is already in use.`,
                        'SLUG_EXISTS',
                    );
                }
                organization.updateSlug(slug.value);
            }
        }

        await this.organizationRepository.save(organization);
        return organization;
    }
}
