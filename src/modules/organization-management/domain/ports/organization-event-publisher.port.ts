import { DomainEvent } from '../events/domain-event';

export interface OrganizationEventPublisherPort {
    publish(event: DomainEvent): Promise<void>;
}
