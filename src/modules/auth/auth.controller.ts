import { Request, Response } from 'express';
import { authService } from './auth.service';
import { asyncHandler } from '@common/utils/asyncHandler';
import { LoginDto } from './auth.validator';
import { ApiResponse } from '@common/types/response';
import { authResource } from './auth.resource';

export const authController = {
    /**
     * Authenticates credentials and returns a secure network payload wrapper.
     */
    login: asyncHandler(async (req: Request<{}, {}, LoginDto>, res: Response<ApiResponse>) => {
        const { user, token } = await authService.login(req.body);

        res.status(200).json({
            success: true,
            message: 'Authentication session initialized successfully',
            data: authResource.toAuthPayload(user, token), // Laravel-Style Transformation
            meta: { timestamp: new Date().toISOString() },
        });
    }),

    /**
     * Resolves the profile identity of the current bearer session.
     */
    me: asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
        // req.user is supplied down the request chain via your authenticate JWT middleware
        res.status(200).json({
            success: true,
            message: 'Current active session context resolved',
            data: authResource.me(req.user), // Cleanly filters out hidden database artifacts
            meta: { timestamp: new Date().toISOString() },
        });
    }),
};
