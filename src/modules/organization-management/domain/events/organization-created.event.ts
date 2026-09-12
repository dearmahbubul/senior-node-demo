import { randomUUID } from 'node:crypto';
import { DomainEvent } from './domain-event';

export interface OrganizationCreatedData {
    organizationId: string;
    name: string;
    slug: string;
    subdomain: string;
    ownerId: string;
}

export type OrganizationCreatedEvent = DomainEvent & {
    type: 'organization.created';
    data: OrganizationCreatedData;
};

export function organizationCreatedEvent(data: OrganizationCreatedData): OrganizationCreatedEvent {
    return {
        eventId: randomUUID(),
        type: 'organization.created',
        occurredAt: new Date(),
        organizationId: data.organizationId,
        data,
    };
}
