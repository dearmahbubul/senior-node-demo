import { DomainError } from '@common/errors/DomainError';

const FQDN_PATTERN =
    /^(?=.{4,253}$)(?![\d.]+$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/;

/**
 * An optional verified FQDN for the organization (e.g. "app.acme.com").
 * Unique across tenants and only active after DNS verification succeeds.
 */
export class CustomDomain {
    private constructor(public readonly value: string) {}

    static create(input: string): CustomDomain {
        const value = input.trim().toLowerCase().replace(/\.$/, '');
        if (value.startsWith('*.')) {
            throw new DomainError(
                'INVALID_CUSTOM_DOMAIN',
                'Wildcard domains are not allowed. Provide a concrete domain, e.g. "app.acme.com".',
            );
        }
        if (!FQDN_PATTERN.test(value)) {
            throw new DomainError(
                'INVALID_CUSTOM_DOMAIN',
                'Custom domain must be a valid lowercase hostname, e.g. "app.acme.com".',
            );
        }
        return new CustomDomain(value);
    }

    toString(): string {
        return this.value;
    }
}
