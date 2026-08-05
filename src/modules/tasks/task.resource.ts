// public TypeScript contracts for your API documentation and frontends
export interface TaskUserResponse {
    id: string;
    name: string | null;
    email: string;
}

export interface TaskListItemResponse {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    creator: TaskUserResponse;
}

export interface TaskDetailResponse extends TaskListItemResponse {
    description: string | null;
    assignedTo: TaskUserResponse | null;
}

export const taskResource = {
    /**
     * Transforms raw data into a lightweight list structure (Optimized for Mobile lists/grids)
     */
    listItem(task: any): TaskListItemResponse {
        return {
            id: task.id,
            title: task.title,
            status: task.status,
            createdAt: task.createdAt.toISOString(),
            creator: {
                id: task.user.id,
                name: task.user.name,
                email: task.user.email,
            },
        };
    },

    /**
     * Transforms raw data into a heavy, comprehensive layout structure (Optimized for Detail screens)
     */
    detail(task: any): TaskDetailResponse {
        return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            createdAt: task.createdAt.toISOString(),
            creator: {
                id: task.user.id,
                name: task.user.name,
                email: task.user.email,
            },
            assignedTo: task.assignedTo
                ? {
                      id: task.assignedTo.id,
                      name: task.assignedTo.name,
                      email: task.assignedTo.email,
                  }
                : null,
        };
    },

    /**
     * Maps arrays using the specific collection method your endpoint requires
     */
    collection(tasks: any[]): TaskListItemResponse[] {
        return tasks.map((task) => this.listItem(task));
    },
};
