import { AppError } from '@common/errors/AppError';
import { NotFoundError } from '@common/errors/NotFoundError';

/**
 * Maps the tiny subset of Prisma client errors the adapters can hit into the
 * AppError family so use cases never need to know Prisma error codes.
 */
export function translatePrismaError(err: unknown): unknown {
    if (isPrismaError(err, 'P2002')) {
        const fields = extractUniqueFields(err);
        return new AppError(409, `A record with the same ${fields} already exists.`, 'CONFLICT');
    }
    if (isPrismaError(err, 'P2003')) {
        return new NotFoundError('Related record not found.', 'RELATED_RECORD_NOT_FOUND');
    }
    if (isPrismaError(err, 'P2025')) {
        return new NotFoundError('Record not found.', 'RECORD_NOT_FOUND');
    }
    return err;
}

function isPrismaError(err: unknown, code: string): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: unknown }).code === code
    );
}

function extractUniqueFields(err: unknown): string {
    const meta = (err as { meta?: { target?: unknown } }).meta;
    const target = Array.isArray(meta?.target) ? meta.target.join(', ') : 'field';
    return target;
}
