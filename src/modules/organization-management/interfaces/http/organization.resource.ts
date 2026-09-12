import { Organization } from '../../domain/entities/organization.entity';
import { OrganizationMembership } from '../../domain/entities/organization-membership.entity';
import { OrgRole } from '../../domain/value-objects/org-role.vo';
import { tenantUrlForOrganization } from '../../application/create-organization.use-case';

export interface OrganizationResponse {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    customDomain: string | null;
    customDomainVerified: boolean;
    customDomainPendingVerification: boolean;
    tenantUrl: string;
    ownerId: string;
    role: OrgRole | null;
    createdAt: string;
    updatedAt: string;
}

export interface ListOrganizationResponse {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
    customDomain: string | null;
    customDomainVerified: boolean;
    tenantUrl: string;
    ownerId: string;
    role: OrgRole;
    createdAt: string;
    updatedAt: string;
}

export interface MembershipResponse {
    id: string;
    organizationId: string;
    userId: string;
    role: OrgRole;
    joinedAt: string;
}

export interface ListMembershipResult {
    memberships: MembershipResponse[];
    total: number;
}

export const organizationResource = {
    single(organization: Organization, role: OrgRole | null = null): OrganizationResponse {
        return {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            subdomain: organization.subdomain,
            customDomain: organization.customDomain,
            customDomainVerified: organization.customDomainVerifiedAt !== null,
            customDomainPendingVerification: organization.customDomainVerificationToken !== null,
            tenantUrl: tenantUrlForOrganization(organization),
            ownerId: organization.ownerId,
            role,
            createdAt: organization.createdAt.toISOString(),
            updatedAt: organization.updatedAt.toISOString(),
        };
    },

    collection(
        items: Array<{ organization: Organization; role: OrgRole }>,
    ): ListOrganizationResponse[] {
        return items.map(({ organization, role }) => ({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            subdomain: organization.subdomain,
            customDomain: organization.customDomain,
            customDomainVerified: organization.customDomainVerifiedAt !== null,
            tenantUrl: tenantUrlForOrganization(organization),
            ownerId: organization.ownerId,
            role,
            createdAt: organization.createdAt.toISOString(),
            updatedAt: organization.updatedAt.toISOString(),
        }));
    },
};

export const membershipResource = {
    single(membership: OrganizationMembership): MembershipResponse {
        return {
            id: membership.id,
            organizationId: membership.organizationId,
            userId: membership.userId,
            role: membership.role,
            joinedAt: membership.joinedAt.toISOString(),
        };
    },

    collection(memberships: OrganizationMembership[]): ListMembershipResult {
        return {
            memberships: memberships.map((membership) => this.single(membership)),
            total: memberships.length,
        };
    },
};
