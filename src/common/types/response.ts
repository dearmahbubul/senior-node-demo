export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: {
        code: string;
        details?: any;
    };
    meta?: {
        timestamp: string;
        [key: string]: any; // Ideal for pagination on web/mobile grids
    };
}
