import { User } from '../../generated/prisma/client';

export interface UserResponse {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
}

export const userResource = {
    /**
     * Transforms a single user record (Laravel's unique resource item)
     */
    single(user: User): UserResponse {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt.toISOString(), // Standardized string format for mobile/web
        };
    },

    /**
     * Transforms a collection of user records (Laravel's resource collection)
     */
    collection(users: User[]): UserResponse {
        return users.map((user) => this.single(user)) as any;
    },
};
