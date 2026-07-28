import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export const authController = {
    login: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.login(req.body);
            res.status(200).json(result);
        } catch (err) {
            next(err);
        }
    },

    me: async (req: Request, res: Response) => {
        res.status(200).json({ user: req.user });
    },
};