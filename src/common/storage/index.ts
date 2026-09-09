import { env } from '@config/env';
import { LocalStorageProvider } from './local.provider';
import { S3StorageProvider } from './s3.provider';
import { StorageProvider } from './storage.provider';

let instance: StorageProvider | null = null;

/** Single shared provider, chosen once at first use from env config. */
export function getStorage(): StorageProvider {
    if (!instance) {
        instance =
            env.storage.driver === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
    }
    return instance;
}
