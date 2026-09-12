import { randomInt, randomUUID } from 'node:crypto';
import { AppError } from '@common/errors/AppError';
import { env } from '@config/env';
import { Organization } from '../domain/entities/organization.entity';
import { OrganizationMembership } from '../domain/entities/organization-membership.entity';
import { Slug } from '../domain/value-objects/slug.vo';
import { Subdomain } from '../domain/value-objects/subdomain.vo';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { OrganizationEventPublisherPort } from '../domain/ports/organization-event-publisher.port';
import { organizationCreatedEvent } from '../domain/events/organization-created.event';

export interface CreateOrganizationInput {
    actorId: string;
    name: string;
    slug?: string;
}

const MAX_SUBDOMAIN_ATTEMPTS = 5;

/**
 * Creates a workspace / tenant. The first user becomes the OWNER. The default
 * subdomain is auto-provisioned from the slug (a random suffix is appended on
 * collision), and the resulting tenant URL is `https://{subdomain}.{APP_BASE_HOST}`.
 */
export class CreateOrganizationUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
        private readonly eventPublisher: OrganizationEventPublisherPort,
    ) {}

    async execute(input: CreateOrganizationInput): Promise<Organization> {
        const slug = input.slug ? Slug.create(input.slug) : Slug.create(input.name);

        if (await this.organizationRepository.findBySlug(slug.value)) {
            throw new AppError(409, `The slug "${slug.value}" is already in use.`, 'SLUG_EXISTS');
        }

        const subdomain = await this.provisionSubdomain(slug.value);

        const organization = Organization.create({
            id: randomUUID(),
            name: input.name,
            slug: slug.value,
            ownerId: input.actorId,
            subdomain,
        });

        await this.organizationRepository.create(organization);

        const membership = OrganizationMembership.create({
            id: randomUUID(),
            organizationId: organization.id,
            userId: input.actorId,
            role: 'OWNER',
        });
        await this.membershipRepository.create(membership);

        await this.eventPublisher.publish(
            organizationCreatedEvent({
                organizationId: organization.id,
                name: organization.name,
                slug: organization.slug,
                subdomain: organization.subdomain,
                ownerId: organization.ownerId,
            }),
        );

        return organization;
    }

    private async provisionSubdomain(candidate: string): Promise<string> {
        const base = Subdomain.canBeAutoProvisioned(candidate) ? candidate : `${candidate}-x`;
        if (!(await this.organizationRepository.findBySubdomain(base))) {
            return base;
        }
        for (let attempt = 0; attempt < MAX_SUBDOMAIN_ATTEMPTS; attempt += 1) {
            const candidateWithSuffix = `${base}-${randomInt(0, 1_000_000)}`;
            if (!(await this.organizationRepository.findBySubdomain(candidateWithSuffix))) {
                return candidateWithSuffix;
            }
        }
        throw new AppError(
            409,
            'Could not allocate a unique subdomain. Please try again.',
            'SUBDOMAIN_EXISTS',
        );
    }
}

export function tenantUrlForOrganization(organization: Organization): string {
    return organization.tenantUrl(env.appBaseHost);
}
