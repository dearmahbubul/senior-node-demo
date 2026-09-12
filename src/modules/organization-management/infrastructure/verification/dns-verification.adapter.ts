import { resolveTxt } from 'node:dns/promises';
import { logger } from '@common/logger';
import {
    DomainVerificationPort,
    DomainVerificationRecord,
} from '../../domain/ports/domain-verification.port';

const VERIFICATION_PREFIX = '_taskflow-verification';

/**
 * DomainVerificationPort implemented with Node's built-in DNS resolver — no
 * external dependency. An optional provider adapter (Route53/Cloudflare) can be
 * swapped in later to also create records automatically.
 */
export class DnsVerificationAdapter implements DomainVerificationPort {
    getTxtRecord(domain: string, token: string): DomainVerificationRecord {
        return {
            recordName: `${VERIFICATION_PREFIX}.${domain}`,
            recordValue: token,
        };
    }

    async checkTxtRecord(domain: string, token: string): Promise<boolean> {
        const recordName = `${VERIFICATION_PREFIX}.${domain}`;
        try {
            const records = await resolveTxt(recordName);
            const normalizedToken = token.trim().toLowerCase();
            // DNS TXT records may split a value into multiple 255-byte chunks.
            return records.some((chunks) =>
                chunks.join('').toLowerCase().includes(normalizedToken),
            );
        } catch (err) {
            // Record missing or DNS not propagated yet — treated as "not verified".
            logger.debug({ err, recordName }, 'TXT record lookup failed');
            return false;
        }
    }
}
