import { AppError } from './AppError';

export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details: Record<string, string> | null = null) {
        super(400, message, 'VALIDATION_ERROR', details);
    }
}
