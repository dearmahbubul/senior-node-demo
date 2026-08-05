// 1. You MUST include at least one top-level import or export statement.
// This forces TypeScript to treat this file as a module extension rather than a script.
import { JwtPayload } from '../../modules/auth/auth.validator';

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}