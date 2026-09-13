import { OrgRole } from '../value-objects/org-role.vo';

/**
 * Plain read model for a tenant/workspace. Intentionally a subset of the
 * domain aggregate: no internal state (e.g. verification token) leaks out.
 */
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
 * Read-side query port — the only public surface other modules (or common
 * middleware) may call for tenant + membership lookups. Returns plain read
 * models and never domain aggregates. Reads hit the primary DB on purpose:
 * tenant resolution and membership are consistency-critical and must never go
 * to a read replica (see 07).
 */
export interface OrganizationQueryPort {
    findById(orgId: string): Promise<OrganizationReadModel | null>;
    findBySubdomain(subdomain: string): Promise<OrganizationReadModel | null>;
    findByCustomDomain(customDomain: string): Promise<OrganizationReadModel | null>;

    /**
     * Resolves a `Host` header to an organization: exact custom-domain match
     * first, then `{subdomain}.{APP_BASE_HOST}`. Returns null for hosts that
     * cannot be mapped to a tenant.
     */
    findByHost(host: string): Promise<OrganizationReadModel | null>;

    hasMember(orgId: string, userId: string, minRole?: OrgRole): Promise<boolean>;
    getMembershipRole(orgId: string, userId: string): Promise<OrgRole | null>;
}
