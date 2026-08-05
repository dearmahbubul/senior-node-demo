import { Request, Response } from 'express';
import { taskService } from './task.service';
import { asyncHandler } from '@common/utils/asyncHandler';
import { CreateTaskInput, TaskParamsInput, UpdateTaskStatusInput } from './task.validator';
import { ApiResponse } from '@common/types/response';
import { taskResource } from './task.resource'; // Import your resource transformation matrix

export const taskController = {
    /*create: asyncHandler(
        async (req: Request<{}, {}, CreateTaskInput>, res: Response<ApiResponse>) => {
            const task = await taskService.createTask(req.body);

            // Fetch fresh relational detail to send a full response structure upon creation
            const cleanTask = await taskService.getTaskById(task.id);

            res.status(201).json({
                success: true,
                message: 'Task initialized and registered successfully',
                data: taskResource.detail(cleanTask), // Returns the complete detailed payload contract
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),*/

    create: asyncHandler(
        async (req: Request<{}, {}, CreateTaskInput>, res: Response<ApiResponse>) => {
            // 1. One line to handle execution and fetch nested fields
            const task = await taskService.createTask(req.body);

            // 2. Return cleanly transformed Laravel-style Resource data
            res.status(201).json({
                success: true,
                message: 'Task initialized and registered successfully',
                data: taskResource.detail(task),
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),

    getById: asyncHandler(async (req: Request<TaskParamsInput>, res: Response<ApiResponse>) => {
        const task = await taskService.getTaskById(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Task trace found',
            data: taskResource.detail(task), // Returns the complete detailed payload contract
            meta: { timestamp: new Date().toISOString() },
        });
    }),

    list: asyncHandler(async (_req: Request, res: Response<ApiResponse>) => {
        const tasks = await taskService.listTasks();

        res.status(200).json({
            success: true,
            message: 'Active tasks catalog synchronized',
            data: taskResource.collection(tasks), // Emits the optimized, lightweight list array structure
            meta: {
                count: tasks.length,
                timestamp: new Date().toISOString(),
            },
        });
    }),

    updateStatus: asyncHandler(
        async (
            req: Request<TaskParamsInput, {}, UpdateTaskStatusInput>,
            res: Response<ApiResponse>,
        ) => {
            await taskService.updateTaskStatus(req.params.id, req.body);

            // Fetch fresh database details following status changes
            const updatedTask = await taskService.getTaskById(req.params.id);

            res.status(200).json({
                success: true,
                message: `Task pipeline shifted to ${req.body.status}`,
                data: taskResource.detail(updatedTask), // Emits updated payload configuration details
                meta: { timestamp: new Date().toISOString() },
            });
        },
    ),
};
