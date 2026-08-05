import { Request, Response } from 'express';
import { userService } from './user.service';
import { asyncHandler } from '@common/utils/asyncHandler';
import { CreateUserDto, UserParamsDto } from './user.validator';
import { ApiResponse } from '@common/types/response';
import { userResource } from './user.resource'; // Import your resource

export const userController = {
    create: asyncHandler(
        async (req: Request<{}, {}, CreateUserDto>, res: Response<ApiResponse>) => {
            const rawUser = await userService.createUser(req.body);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                // ✅ Laravel Style: Only sanitized data goes down the wire
                data: userResource.single(rawUser),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    getById: asyncHandler(async (req: Request<UserParamsDto>, res: Response<ApiResponse>) => {
        const rawUser = await userService.getUserById(req.params.id);

        res.status(200).json({
            success: true,
            message: 'User records synchronized',
            // ✅ Sanitize your fetch responses too
            data: userResource.single(rawUser),
            meta: { timestamp: new Date().toISOString() },
        });
    }),
};
