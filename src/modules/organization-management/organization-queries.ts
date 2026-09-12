import { prisma } from '@db/client';
import type {
    Organization as PrismaOrganization,
    OrgRole as PrismaOrgRole,
} from '@generated/prisma/client';
import { env } from '@config/env';
import { hasMinimumRole, isOrgRole, OrgRole } from './domain/value-objects/org-role.vo';

export interface OrganizationReadModel {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    customDomain: string | null;
    customDomainVerifiedAt: Date | null;
    ownerId: string;
}

/**
 * Read-side query facade — the ONLY public surface other modules (or common
 * middleware) may call. No domain entity is leaked; this returns plain read
 * models. Reads hit the primary DB on purpose: tenant resolution and membership
 * are consistency-critical and must never go to a read replica (see 07).
 */
export const organizationQueries = {
    async findById(orgId: string): Promise<OrganizationReadModel | null> {
        const raw = await prisma.organization.findUnique({ where: { id: orgId } });
        return raw ? toReadModel(raw) : null;
    },

    async findBySubdomain(subdomain: string): Promise<OrganizationReadModel | null> {
        const raw = await prisma.organization.findUnique({ where: { subdomain } });
        return raw ? toReadModel(raw) : null;
    },

    async findByCustomDomain(customDomain: string): Promise<OrganizationReadModel | null> {
        const raw = await prisma.organization.findUnique({ where: { customDomain } });
        return raw ? toReadModel(raw) : null;
    },

    /**
     * Resolves a `Host` header to an organization: exact custom-domain match
     * first, then `{subdomain}.{APP_BASE_HOST}`. Returns null for hosts that
     * cannot be mapped to a tenant.
     */
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
    },

    async hasMember(orgId: string, userId: string, minRole?: OrgRole): Promise<boolean> {
        const membership = await prisma.organizationMembership.findUnique({
            where: { organizationId_userId: { organizationId: orgId, userId } },
        });
        if (!membership) return false;
        if (!minRole) return true;
        return hasMinimumRole(toDomainRole(membership.role), minRole);
    },

    async getMembershipRole(orgId: string, userId: string): Promise<OrgRole | null> {
        const membership = await prisma.organizationMembership.findUnique({
            where: { organizationId_userId: { organizationId: orgId, userId } },
        });
        return membership ? toDomainRole(membership.role) : null;
    },
};

function toReadModel(raw: PrismaOrganization): OrganizationReadModel {
    return {
        id: raw.id,
        name: raw.name,
        slug: raw.slug,
        subdomain: raw.subdomain,
        customDomain: raw.customDomain,
        customDomainVerifiedAt: raw.customDomainVerifiedAt,
        ownerId: raw.ownerId,
    };
}

function toDomainRole(role: PrismaOrgRole): OrgRole {
    return isOrgRole(role) ? role : 'MEMBER';
}
