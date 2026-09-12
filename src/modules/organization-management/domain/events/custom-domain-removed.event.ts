import { randomUUID } from 'node:crypto';
import { DomainEvent } from './domain-event';

export interface CustomDomainRemovedData {
    organizationId: string;
    customDomain: string;
}

export type CustomDomainRemovedEvent = DomainEvent & {
    type: 'organization.custom_domain_removed';
    data: CustomDomainRemovedData;
};

export function customDomainRemovedEvent(data: CustomDomainRemovedData): CustomDomainRemovedEvent {
    return {
        eventId: randomUUID(),
        type: 'organization.custom_domain_removed',
        occurredAt: new Date(),
        organizationId: data.organizationId,
        data,
    };
}
