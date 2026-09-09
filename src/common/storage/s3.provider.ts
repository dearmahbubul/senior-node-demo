import {
    DeleteObjectCommand,
    GetObjectCommand,
    NotFound as S3NotFound,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { StorageProvider, StoredObject } from './storage.provider';
import { env } from '@config/env';

export class S3StorageProvider implements StorageProvider {
    readonly driver = 's3' as const;
    private readonly client: S3Client;
    private readonly bucket: string;

    constructor() {
        this.bucket = env.storage.s3.bucket!;
        this.client = new S3Client({
            region: env.storage.s3.region!,
            credentials: {
                accessKeyId: env.storage.s3.accessKeyId!,
                secretAccessKey: env.storage.s3.secretAccessKey!,
            },
            // MinIO / LocalStack compatible endpoint (ignored when unset)
            ...(env.storage.s3.endpoint
                ? { endpoint: env.storage.s3.endpoint, forcePathStyle: true }
                : {}),
        });
    }

    async save(key: string, body: Buffer, mimeType: string): Promise<StoredObject> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: mimeType,
            }),
        );
        return { key };
    }

    async read(key: string): Promise<Buffer> {
        try {
            const res = await this.client.send(
                new GetObjectCommand({ Bucket: this.bucket, Key: key }),
            );
            return Buffer.from(await res.Body!.transformToByteArray());
        } catch (err) {
            if (err instanceof S3NotFound) {
                throw new Error(`Object not found in bucket: ${key}`);
            }
            throw err;
        }
    }

    async delete(key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
}
