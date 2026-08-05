export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code: string,
        public details: any = null,
    ) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
/*
export class AppError extends Error {
  constructor(public message: string, public status: number = 500) {
    super(message);
    this.name = 'AppError';
  }
}*/
