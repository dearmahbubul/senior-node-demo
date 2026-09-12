import { DomainError } from '@common/errors/DomainError';

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61})[a-z0-9]$/;

/**
 * Subdomains an operator would never hand out because they conflict with
 * platform/system tooling.
 */
export const RESERVED_SUBDOMAINS = new Set([
    'www',
    'api',
    'app',
    'admin',
    'mail',
    'ftp',
    'docs',
    'support',
    'status',
    'help',
    'cdn',
    'assets',
]);

/**
 * Default tenant subdomain label — unique, 3-63 chars, lowercase alphanumeric
 * plus internal hyphens. Auto-provisioned from the slug at organization
 * creation and editable later by OWNER/ADMIN.
 */
export class Subdomain {
    private constructor(public readonly value: string) {}

    static create(input: string): Subdomain {
        const value = input.trim().toLowerCase();
        if (!SUBDOMAIN_PATTERN.test(value)) {
            throw new DomainError(
                'INVALID_SUBDOMAIN',
                'Subdomain must be 3-63 characters using lowercase letters, numbers, or hyphens (never starting or ending with a hyphen).',
            );
        }
        if (this.isReserved(value)) {
            throw new DomainError(
                'RESERVED_SUBDOMAIN',
                `"${value}" is a reserved subdomain and cannot be used.`,
            );
        }
        return new Subdomain(value);
    }

    static isReserved(value: string): boolean {
        return RESERVED_SUBDOMAINS.has(value);
    }

    /** true when a raw candidate can be used as-is (valid shape, not reserved). */
    static canBeAutoProvisioned(input: string): boolean {
        const value = input.trim().toLowerCase();
        return SUBDOMAIN_PATTERN.test(value) && !this.isReserved(value);
    }

    toString(): string {
        return this.value;
    }
}
