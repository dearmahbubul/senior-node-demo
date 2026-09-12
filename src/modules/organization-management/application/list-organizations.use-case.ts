import { Organization } from '../domain/entities/organization.entity';
import { OrgRole } from '../domain/value-objects/org-role.vo';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';

export interface ListOrganizationResult {
    organization: Organization;
    role: OrgRole;
}

export class ListOrganizationsUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
    ) {}

    async execute(input: { actorId: string }): Promise<ListOrganizationResult[]> {
        const memberships = await this.membershipRepository.listByUser(input.actorId);
        const organizations: ListOrganizationResult[] = [];
        for (const membership of memberships) {
            const organization = await this.organizationRepository.findById(
                membership.organizationId,
            );
            if (organization) {
                organizations.push({ organization, role: membership.role });
            }
        }
        return organizations;
    }
}
