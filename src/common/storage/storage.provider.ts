export interface StoredObject {
    /** Provider-specific location identifier persisted in the DB */
    key: string;
    /** Public or signed URL where the object can be fetched, if applicable */
    url?: string;
}

export interface StorageProvider {
    readonly driver: 'local' | 's3';

    /**
     * Persists bytes under a provider-managed key.
     * Implementations must never trust caller-supplied paths.
     */
    save(key: string, body: Buffer, mimeType: string): Promise<StoredObject>;

    /** Reads the full object (fine for the size ranges we allow). */
    read(key: string): Promise<Buffer>;

    /** Removes the object. Must be idempotent: deleting a missing key resolves. */
    delete(key: string): Promise<void>;
}
