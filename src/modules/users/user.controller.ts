import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';

export const userController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getUserById(<string>req.params.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  },
};