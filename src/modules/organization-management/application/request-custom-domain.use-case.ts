import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { Organization } from '../domain/entities/organization.entity';
import { CustomDomain } from '../domain/value-objects/custom-domain.vo';
import { DomainVerificationPort } from '../domain/ports/domain-verification.port';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { assertMinimumRole } from './authorization';

export interface RequestCustomDomainInput {
    orgId: string;
    actorId: string;
    domain: string;
}

export interface RequestCustomDomainResult {
    organization: Organization;
    recordName: string;
    recordValue: string;
}

/**
 * Stages a custom domain for verification: normalizes + uniqueness-checks the
 * FQDN, generates a fresh TXT token and persists `{ customDomain, token }`.
 * The domain stays inactive until VerifyCustomDomainUseCase succeeds.
 * Returns the exact DNS record the admin must publish.
 */
export class RequestCustomDomainUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
        private readonly domainVerification: DomainVerificationPort,
    ) {}

    async execute(input: RequestCustomDomainInput): Promise<RequestCustomDomainResult> {
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

        const normalizedDomain = CustomDomain.create(input.domain).value;
        const inUse = await this.organizationRepository.findByCustomDomain(normalizedDomain);
        if (inUse && inUse.id !== organization.id) {
            throw new AppError(
                409,
                `The domain "${normalizedDomain}" is already registered to another organization.`,
                'CUSTOM_DOMAIN_EXISTS',
            );
        }

        const { token } = organization.requestCustomDomain(input.domain);
        const record = this.domainVerification.getTxtRecord(normalizedDomain, token);

        await this.organizationRepository.save(organization);

        return { organization, recordName: record.recordName, recordValue: record.recordValue };
    }
}
