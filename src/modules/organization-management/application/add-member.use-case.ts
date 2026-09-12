import { randomUUID } from 'node:crypto';
import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';
import { OrganizationMembership } from '../domain/entities/organization-membership.entity';
import { OrgRole, isOrgRole } from '../domain/value-objects/org-role.vo';
import { OrganizationRepositoryPort } from '../domain/ports/organization.repository.port';
import { OrganizationMembershipRepositoryPort } from '../domain/ports/organization-membership.repository.port';
import { OrganizationEventPublisherPort } from '../domain/ports/organization-event-publisher.port';
import { memberAddedEvent } from '../domain/events/member-added.event';
import { assertMinimumRole } from './authorization';

export interface AddMemberInput {
    orgId: string;
    actorId: string;
    userId: string;
    role: OrgRole;
}

export class AddMemberUseCase {
    constructor(
        private readonly organizationRepository: OrganizationRepositoryPort,
        private readonly membershipRepository: OrganizationMembershipRepositoryPort,
        private readonly eventPublisher: OrganizationEventPublisherPort,
    ) {}

    async execute(input: AddMemberInput): Promise<OrganizationMembership> {
        if (!isOrgRole(input.role)) {
            throw new AppError(
                400,
                `"${input.role}" is not a valid organization role.`,
                'INVALID_ROLE',
            );
        }

        const organization = await this.organizationRepository.findById(input.orgId);
        if (!organization) {
            throw new NotFoundError('Organization not found.', 'ORGANIZATION_NOT_FOUND');
        }

        const actorMembership = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.actorId,
        );
        if (!actorMembership) {
            throw new AppError(403, 'You are not a member of this organization.', 'NOT_A_MEMBER');
        }
        assertMinimumRole(actorMembership, 'ADMIN');

        const existing = await this.membershipRepository.findByOrganizationAndUser(
            input.orgId,
            input.userId,
        );
        if (existing) {
            throw new AppError(
                409,
                'This user is already a member of the organization.',
                'MEMBER_EXISTS',
            );
        }

        const membership = OrganizationMembership.create({
            id: randomUUID(),
            organizationId: input.orgId,
            userId: input.userId,
            role: input.role,
        });
        await this.membershipRepository.create(membership);

        await this.eventPublisher.publish(
            memberAddedEvent({
                organizationId: input.orgId,
                userId: input.userId,
                role: input.role,
                addedBy: input.actorId,
            }),
        );

        return membership;
    }
}
