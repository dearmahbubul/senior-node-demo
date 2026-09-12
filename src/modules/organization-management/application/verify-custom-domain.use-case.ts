import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { Organization } from '../domain/entities/organization.entity';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { OrganizationEventPublisherPort } from '../domain/ports/organization-event-publisher.port';
import { DomainVerificationPort } from '../domain/ports/domain-verification.port';
import { assertMinimumRole } from './authorization';

export interface VerifyCustomDomainInput {
    orgId: string;
    actorId: string;
}

export interface VerifyCustomDomainResult {
    organization: Organization;
    customDomain: string;
    tenantUrl: string;
}

export class VerifyCustomDomainUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
        private readonly domainVerification: DomainVerificationPort,
        private readonly eventPublisher: OrganizationEventPublisherPort,
    ) {}

    async execute(input: VerifyCustomDomainInput): Promise<VerifyCustomDomainResult> {
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

        const { domain, token } = requirePendingDomain(organization);

        const recordFound = await this.domainVerification.checkTxtRecord(domain, token);

        const event = organization.verifyCustomDomain(recordFound);
        if (!event) {
            throw new AppError(
                409,
                'The DNS TXT record was not found or has not propagated yet. Please publish the record and try again.',
                'CUSTOM_DOMAIN_VERIFICATION_FAILED',
                { recordName: `_taskflow-verification.${domain}` },
            );
        }

        await this.organizationRepository.save(organization);
        await this.eventPublisher.publish(event);

        return {
            organization,
            customDomain: domain,
            tenantUrl: `https://${domain}`,
        };
    }
}

function requirePendingDomain(organization: Organization): { domain: string; token: string } {
    if (!organization.hasPendingCustomDomain()) {
        throw new NotFoundError(
            'No custom domain is pending verification. Request one first.',
            'CUSTOM_DOMAIN_NOT_PENDING',
        );
    }
    return {
        domain: organization.customDomain as string,
        token: organization.customDomainVerificationToken as string,
    };
}
