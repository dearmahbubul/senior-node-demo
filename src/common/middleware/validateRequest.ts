import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError } from '../errors/ValidationError';

// Express 5 defines req.query/req.params as getter-only — we must mutate the
// existing objects instead of assigning new ones.
function replaceInPlace(
    target: Record<string, unknown>,
    data: Record<string, unknown> | undefined,
) {
    if (!data) return;
    for (const key of Object.keys(target)) {
        if (!(key in data)) delete target[key];
    }
    Object.assign(target, data);
}

export const validateRequest =
    (schema: z.ZodObject<any>) =>
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            // Strips extra data from the client that isn't defined in the Zod schema
            const parsed = (await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            })) as {
                body?: Record<string, unknown>;
                query?: Record<string, unknown>;
                params?: Record<string, unknown>;
            };

            req.body = parsed.body; // plain property, safe to assign
            replaceInPlace(req.params as Record<string, unknown>, parsed.params);
            replaceInPlace(req.query as Record<string, unknown>, parsed.query);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Aggregate every issue into { field: message }, dropping the
                // 'body'/'query'/'params' root prefix for clean client-facing keys
                const validationFields = error.issues.reduce<Record<string, string>>(
                    (acc, curr) => {
                        const path = curr.path.slice(1).join('.');
                        acc[path] = curr.message;
                        return acc;
                    },
                    {},
                );

                return next(new ValidationError('Input validation failed', validationFields));
            }
            return next(error);
        }
    };
