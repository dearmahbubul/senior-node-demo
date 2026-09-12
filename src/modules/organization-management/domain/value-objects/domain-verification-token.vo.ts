import { randomBytes } from 'node:crypto';
import { DomainError } from '@common/errors/DomainError';

const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

/**
 * Per-organization random token the admin must publish as a TXT record
 * (`_taskflow-verification.<domain>`) to prove domain ownership. Regenerated
 * on every custom-domain request.
 */
export class DomainVerificationToken {
    private constructor(public readonly value: string) {}

    static generate(): DomainVerificationToken {
        return new DomainVerificationToken(randomBytes(16).toString('hex'));
    }

    static create(value: string): DomainVerificationToken {
        if (!TOKEN_PATTERN.test(value)) {
            throw new DomainError(
                'INVALID_VERIFICATION_TOKEN',
                'Verification token must be 32 lowercase hex characters.',
            );
        }
        return new DomainVerificationToken(value);
    }

    matches(candidate: string): boolean {
        return this.value.toLowerCase() === candidate.trim().toLowerCase();
    }

    toString(): string {
        return this.value;
    }
}
