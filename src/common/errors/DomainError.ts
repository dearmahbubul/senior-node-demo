import { AppError } from './AppError';

/**
 * A business-rule violation raised by the domain layer (entities / value
 * objects). Extends AppError (→ 400) so the global error handler treats it
 * like any other intentional, client-facing error.
 */
export class DomainError extends AppError {
    constructor(code: string, message: string, details: Record<string, unknown> | null = null) {
        super(400, message, code, details);
    }
}
