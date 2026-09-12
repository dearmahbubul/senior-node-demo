export interface DomainVerificationRecord {
    recordName: string;
    recordValue: string;
}

export interface DomainVerificationPort {
    /** The exact DNS TXT record the admin must publish to prove ownership. */
    getTxtRecord(domain: string, token: string): DomainVerificationRecord;
    /**
     * Queries DNS for the TXT record under `_taskflow-verification.<domain>`
     * and reports whether any published value contains the token. DNS errors
     * (record missing / not yet propagated) are reported as `false`.
     */
    checkTxtRecord(domain: string, token: string): Promise<boolean>;
}
