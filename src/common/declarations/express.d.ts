// Module augmentation: adds the authenticated JWT claims to Express.Request.
// A top-level import/export makes this file a module, which is required for augmentation.
import { JwtPayload } from '@modules/auth/token.util';

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
