import { PrismaOrganizationRepository } from './infrastructure/persistence/prisma-organization.repository';
import { PrismaOrganizationMembershipRepository } from './infrastructure/persistence/prisma-organization-membership.repository';
import { PrismaOrganizationQuery } from './infrastructure/persistence/prisma-organization.query';
import { DnsVerificationAdapter } from './infrastructure/verification/dns-verification.adapter';
import { LogOrganizationEventPublisher } from './infrastructure/events/organization-event-publisher.adapter';
import type { OrganizationQueryPort } from './domain/ports/organization.query.port';

import { CreateOrganizationUseCase } from './application/create-organization.use-case';
import { GetOrganizationUseCase } from './application/get-organization.use-case';
import { ListOrganizationsUseCase } from './application/list-organizations.use-case';
import { UpdateOrganizationUseCase } from './application/update-organization.use-case';
import { DeleteOrganizationUseCase } from './application/delete-organization.use-case';
import { UpdateSubdomainUseCase } from './application/update-subdomain.use-case';
import { RequestCustomDomainUseCase } from './application/request-custom-domain.use-case';
import { VerifyCustomDomainUseCase } from './application/verify-custom-domain.use-case';
import { RemoveCustomDomainUseCase } from './application/remove-custom-domain.use-case';
import { AddMemberUseCase } from './application/add-member.use-case';
import { ListMembersUseCase } from './application/list-members.use-case';
import { UpdateMemberRoleUseCase } from './application/update-member-role.use-case';
import { RemoveMemberUseCase } from './application/remove-member.use-case';

/**
 * Local composition root for the organization-management module: instantiates
 * the adapters (singletons) and injects them into the use cases. This is the
 * only file in this module that knows every concrete implementation. A shared
 * `common/di` container (which also wires event publishers to consumers) is a
 * planned follow-up; enabling it requires no change to the use cases.
 */

const organizationRepository = new PrismaOrganizationRepository();
const membershipRepository = new PrismaOrganizationMembershipRepository();
const domainVerification = new DnsVerificationAdapter();
const eventPublisher = new LogOrganizationEventPublisher();

// Read-side query adapter — reused by common middleware and HTTP controllers.
export const organizationQueries: OrganizationQueryPort = new PrismaOrganizationQuery(
    organizationRepository,
    membershipRepository,
);

export const createOrganizationUseCase = new CreateOrganizationUseCase(
    organizationRepository,
    membershipRepository,
    eventPublisher,
);

export const getOrganizationUseCase = new GetOrganizationUseCase(
    organizationRepository,
    membershipRepository,
);

export const listOrganizationsUseCase = new ListOrganizationsUseCase(
    organizationRepository,
    membershipRepository,
);

export const updateOrganizationUseCase = new UpdateOrganizationUseCase(
    organizationRepository,
    membershipRepository,
);

export const deleteOrganizationUseCase = new DeleteOrganizationUseCase(
    organizationRepository,
    membershipRepository,
);

export const updateSubdomainUseCase = new UpdateSubdomainUseCase(
    organizationRepository,
    membershipRepository,
    eventPublisher,
);

export const requestCustomDomainUseCase = new RequestCustomDomainUseCase(
    organizationRepository,
    membershipRepository,
    domainVerification,
);

export const verifyCustomDomainUseCase = new VerifyCustomDomainUseCase(
    organizationRepository,
    membershipRepository,
    domainVerification,
    eventPublisher,
);

export const removeCustomDomainUseCase = new RemoveCustomDomainUseCase(
    organizationRepository,
    membershipRepository,
    eventPublisher,
);

export const addMemberUseCase = new AddMemberUseCase(
    organizationRepository,
    membershipRepository,
    eventPublisher,
);

export const listMembersUseCase = new ListMembersUseCase(membershipRepository);

export const updateMemberRoleUseCase = new UpdateMemberRoleUseCase(membershipRepository);

export const removeMemberUseCase = new RemoveMemberUseCase(membershipRepository);
