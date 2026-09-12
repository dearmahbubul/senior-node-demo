import { randomUUID } from 'node:crypto';
import { DomainEvent } from './domain-event';

export interface SubdomainChangedData {
    organizationId: string;
    subdomain: string;
    previousSubdomain: string;
}

export type SubdomainChangedEvent = DomainEvent & {
    type: 'organization.subdomain_changed';
    data: SubdomainChangedData;
};

export function subdomainChangedEvent(data: SubdomainChangedData): SubdomainChangedEvent {
    return {
        eventId: randomUUID(),
        type: 'organization.subdomain_changed',
        occurredAt: new Date(),
        organizationId: data.organizationId,
        data,
    };
}
