export interface DomainEvent {
    eventId: string;
    type: string;
    occurredAt: Date;
    organizationId: string;
}
