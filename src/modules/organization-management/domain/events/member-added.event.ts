import { randomUUID } from 'node:crypto';
import { DomainEvent } from './domain-event';
import { OrgRole } from '../value-objects/org-role.vo';

export interface MemberAddedData {
    organizationId: string;
    userId: string;
    role: OrgRole;
    addedBy: string;
}

export type MemberAddedEvent = DomainEvent & {
    type: 'organization.member_added';
    data: MemberAddedData;
};

export function memberAddedEvent(data: MemberAddedData): MemberAddedEvent {
    return {
        eventId: randomUUID(),
        type: 'organization.member_added',
        occurredAt: new Date(),
        organizationId: data.organizationId,
        data,
    };
}
