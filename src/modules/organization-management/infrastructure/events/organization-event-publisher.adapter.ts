import { logger } from '@common/logger';
import { DomainEvent } from '../../domain/events/domain-event';
import { OrganizationEventPublisherPort } from '../../domain/ports/organization-event-publisher.port';

/**
 * Placeholder OrganizationEventPublisherPort implementation until the shared
 * RabbitMQ wiring (common/di) is in place: records every published event and
 * never fails the request. Swapping in a broker adapter does not touch any use
 * case.
 */
export class LogOrganizationEventPublisher implements OrganizationEventPublisherPort {
    async publish(event: DomainEvent): Promise<void> {
        logger.info(
            { eventId: event.eventId, type: event.type, organizationId: event.organizationId },
            `organization event published: ${event.type}`,
        );
    }
}
