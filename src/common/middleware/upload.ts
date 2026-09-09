import { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/AppError';
import { env } from '@config/env';

export const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/zip',
] as const;

const upload = multer({
    // Memory storage: files are fully validated before touching any storage driver.
    // (For very large media you'd stream to disk/S3 instead — see README notes.)
    storage: multer.memoryStorage(),
    limits: {
        fileSize: env.storage.maxFileSizeMb * 1024 * 1024,
        files: 10, // max attachments per request
    },
    fileFilter: (_req, file, cb) => {
        if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new AppError(
                    400,
                    `File type "${file.mimetype}" is not allowed.`,
                    'UNSUPPORTED_FILE_TYPE',
                    { allowed: ALLOWED_MIME_TYPES },
                ),
            );
        }
    },
});

function mapMulterError(err: unknown): Error | undefined {
    if (!(err instanceof multer.MulterError)) return undefined;
    if (err.code === 'LIMIT_FILE_SIZE') {
        return new AppError(
            400,
            `File exceeds the ${env.storage.maxFileSizeMb}MB size limit.`,
            'FILE_TOO_LARGE',
        );
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
        return new AppError(400, 'Too many files in a single request.', 'TOO_MANY_FILES');
    }
    return new AppError(400, `Upload rejected: ${err.code}`, 'UPLOAD_REJECTED');
}

/** Wraps multer so its errors reach globalErrorHandler in our envelope format. */
export function handleUpload(field: string): RequestHandler {
    const mw = upload.array(field);
    return (req: Request, res: Response, next: NextFunction) => {
        mw(req, res, (err) => {
            const mapped = mapMulterError(err);
            next(mapped ?? err ?? undefined);
        });
    };
}

export function getUploadedFiles(req: Request): Express.Multer.File[] {
    return (req.files as Express.Multer.File[] | undefined) ?? [];
}
