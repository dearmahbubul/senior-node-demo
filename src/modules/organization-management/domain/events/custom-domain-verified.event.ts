import { randomUUID } from 'node:crypto';
import { DomainEvent } from './domain-event';

export interface CustomDomainVerifiedData {
    organizationId: string;
    customDomain: string;
}

export type CustomDomainVerifiedEvent = DomainEvent & {
    type: 'organization.custom_domain_verified';
    data: CustomDomainVerifiedData;
};

export function customDomainVerifiedEvent(
    data: CustomDomainVerifiedData,
): CustomDomainVerifiedEvent {
    return {
        eventId: randomUUID(),
        type: 'organization.custom_domain_verified',
        occurredAt: new Date(),
        organizationId: data.organizationId,
        data,
    };
}
