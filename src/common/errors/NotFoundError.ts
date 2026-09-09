import { AppError } from './AppError';

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', code = 'NOT_FOUND') {
        super(404, message, code);
    }
}
