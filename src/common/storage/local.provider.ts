import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { StorageProvider, StoredObject } from './storage.provider';
import { env } from '@config/env';

/**
 * Filesystem driver. Files live under env.storage.uploadDir.
 * The key is treated as a flat filename — directory traversal is impossible
 * because we never join caller-controlled subpaths.
 */
export class LocalStorageProvider implements StorageProvider {
    readonly driver = 'local' as const;
    private readonly baseDir: string;

    constructor(baseDir: string = env.storage.uploadDir) {
        this.baseDir = path.resolve(process.cwd(), baseDir);
    }

    async save(key: string, body: Buffer, _mimeType: string): Promise<StoredObject> {
        await mkdir(this.baseDir, { recursive: true });
        await writeFile(this.resolve(key), body);
        return { key };
    }

    async read(key: string): Promise<Buffer> {
        return readFile(this.resolve(key));
    }

    async delete(key: string): Promise<void> {
        try {
            await unlink(this.resolve(key));
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
            // Already gone — treat as success (idempotent delete)
        }
    }

    private resolve(key: string): string {
        const safeKey = path.basename(key); // strips any path segments from the key
        return path.join(this.baseDir, safeKey);
    }
}
