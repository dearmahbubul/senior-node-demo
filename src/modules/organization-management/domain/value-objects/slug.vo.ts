import { DomainError } from '@common/errors/DomainError';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

/**
 * URL-safe unique identifier for an organization (e.g. "acme", "dev-tools").
 * Lives in the domain; Prisma stores it as a plain string.
 */
export class Slug {
    private constructor(public readonly value: string) {}

    static create(input: string): Slug {
        const slug = Slug.normalize(input);
        if (!SLUG_PATTERN.test(slug)) {
            throw new DomainError(
                'INVALID_SLUG',
                'Slug must be 3-60 characters using lowercase letters, numbers, or hyphens.',
            );
        }
        return new Slug(slug);
    }

    static normalize(input: string): string {
        return input
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    toString(): string {
        return this.value;
    }
}
