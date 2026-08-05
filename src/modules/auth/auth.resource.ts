export interface AuthUserResponse {
    id: string;
    email: string;
    name: string | null;
}

export interface AuthSuccessResponse {
    token: string;
    user: AuthUserResponse;
}

export const authResource = {
    /**
     * Sanitizes and shapes the final authorization response package
     */
    toAuthPayload(user: any, token: string): AuthSuccessResponse {
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        };
    },

    /**
     * Safe mapping transformer for user identity profiles (/me endpoint)
     */
    me(user: any): AuthUserResponse {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
        };
    },
};
