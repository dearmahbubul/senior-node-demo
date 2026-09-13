import { env } from '@config/env';
import type { Organization } from '../../domain/entities/organization.entity';
import { hasMinimumRole, OrgRole } from '../../domain/value-objects/org-role.vo';
import { OrganizationRepositoryPort } from '../../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../../domain/ports/organization-membership.repository.port';
import {
    OrganizationQueryPort,
    OrganizationReadModel,
} from '../../domain/ports/organization.query.port';

/**
 * Read-side query adapter implementing OrganizationQueryPort. Reuses the
 * existing persistence repositories so tenant/membership reads share a single
 * Prisma path with the write side — this adapter only maps domain aggregates
 * to plain read models and adds host resolution.
 */
export class PrismaOrganizationQuery implements OrganizationQueryPort {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
    ) {}

    async findById(orgId: string): Promise<OrganizationReadModel | null> {
        const organization = await this.organizationRepository.findById(orgId);
        return organization ? toReadModel(organization) : null;
    }

    async findBySubdomain(subdomain: string): Promise<OrganizationReadModel | null> {
        const organization = await this.organizationRepository.findBySubdomain(subdomain);
        return organization ? toReadModel(organization) : null;
    }

    async findByCustomDomain(customDomain: string): Promise<OrganizationReadModel | null> {
        const organization = await this.organizationRepository.findByCustomDomain(customDomain);
        return organization ? toReadModel(organization) : null;
    }

    async findByHost(host: string): Promise<OrganizationReadModel | null> {
        const normalized = host.split(':')[0].toLowerCase();
        const byCustomDomain = await this.findByCustomDomain(normalized);
        if (byCustomDomain) return byCustomDomain;

        const baseHost = env.appBaseHost.toLowerCase();
        const expectedSuffix = `.${baseHost}`;
        if (
            baseHost !== 'localhost' &&
            normalized !== baseHost &&
            normalized.endsWith(expectedSuffix)
        ) {
            const subdomain = normalized.slice(0, -expectedSuffix.length);
            return this.findBySubdomain(subdomain);
        }
        return null;
    }

    async hasMember(orgId: string, userId: string, minRole?: OrgRole): Promise<boolean> {
        const membership = await this.membershipRepository.findByOrganizationAndUser(orgId, userId);
        if (!membership) return false;
        if (!minRole) return true;
        return hasMinimumRole(membership.role, minRole);
    }

    async getMembershipRole(orgId: string, userId: string): Promise<OrgRole | null> {
        const membership = await this.membershipRepository.findByOrganizationAndUser(orgId, userId);
        return membership ? membership.role : null;
    }
}

function toReadModel(organization: Organization): OrganizationReadModel {
    return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subdomain: organization.subdomain,
        customDomain: organization.customDomain,
        customDomainVerifiedAt: organization.customDomainVerifiedAt,
        ownerId: organization.ownerId,
    };
}
