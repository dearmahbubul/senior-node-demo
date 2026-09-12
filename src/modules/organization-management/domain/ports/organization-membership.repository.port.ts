import { OrganizationMembership } from '../entities/organization-membership.entity';

export interface OrganizationMembershipRepositoryPort {
    findById(id: string): Promise<OrganizationMembership | null>;
    findByOrganizationAndUser(
        organizationId: string,
        userId: string,
    ): Promise<OrganizationMembership | null>;
    listByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
    listByUser(userId: string): Promise<OrganizationMembership[]>;
    create(membership: OrganizationMembership): Promise<OrganizationMembership>;
    save(membership: OrganizationMembership): Promise<void>;
    deleteById(id: string): Promise<void>;
}
