export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code: string,
        public details: unknown = null,
    ) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
