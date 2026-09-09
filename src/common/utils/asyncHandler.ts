import { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';

/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * global error handler instead of becoming unhandled rejections.
 * Generics preserve the controller's own req/res typings.
 */
export const asyncHandler =
    <P = ParamsDictionary, ResBody = unknown, ReqBody = unknown>(
        fn: (
            req: Request<P, ResBody, ReqBody>,
            res: Response<ResBody>,
            next: NextFunction,
        ) => Promise<unknown>,
    ): RequestHandler =>
    (req, res, next) => {
        Promise.resolve(
            fn(req as Request<P, ResBody, ReqBody>, res as Response<ResBody>, next),
        ).catch(next);
    };
