import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod'; // ✅ Import 'z' directly instead of AnyZodObject
import { AppError } from '../errors/AppError';

// ✅ Fix 1: Use z.ZodObject<any> to accept any user-defined object schema structure
export const validateRequest =
    (schema: z.ZodObject<any>) =>
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            // Strips extra data from the client that isn't defined in the Zod schema
            const parsed = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            req.body = parsed.body;

            // ✅ Fix 2: Cast to any to securely overwrite the Express default typings
            req.query = parsed.query as any;
            req.params = parsed.params as any;

            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                // ✅ Fix 3: Keep error.issues for Zod v4 error array matching
                const validationFields = error.issues.reduce<Record<string, string>>(
                    (acc, curr) => {
                        // Drops the 'body', 'query', or 'params' root prefix cleanly
                        const path = curr.path.slice(1).join('.');
                        acc[path] = curr.message;
                        return acc;
                    },
                    {},
                );

                return next(
                    new AppError(
                        400,
                        'Input validation failed',
                        'VALIDATION_ERROR',
                        validationFields,
                    ),
                );
            }
            return next(error);
        }
    };
