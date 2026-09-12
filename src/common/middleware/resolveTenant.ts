import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { env } from '@config/env';
import { organizationQueries } from '@modules/organization-management/organization-queries';

/**
 * Host-based tenant resolution: maps the `Host` header (custom domain first,
 * then `{subdomain}.{APP_BASE_HOST}`) to an organization and stashes its id on
 * `res.locals.organizationId`.
 *
 * Requests that cannot be mapped to a tenant are only rejected once host-based
 * routing is actually enabled (APP_BASE_HOST !== 'localhost'): in local dev the
 * API keeps working on `localhost` with `:orgId` taken from the URL.
 */
export async function resolveTenant(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const hostHeader = req.headers.host;
        if (!hostHeader) {
            return next(new AppError(400, 'A Host header is required.', 'MISSING_HOST'));
        }

        const host = hostHeader.split(':')[0].toLowerCase();
        const organization = await organizationQueries.findByHost(host);

        if (organization) {
            res.locals.organizationId = organization.id;
            return next();
        }

        const baseHost = env.appBaseHost.toLowerCase();
        if (baseHost !== 'localhost' && (host === baseHost || host.endsWith(`.${baseHost}`))) {
            return next(new AppError(404, 'Unknown tenant for this host.', 'TENANT_NOT_FOUND'));
        }

        // Unrecognized host (e.g. "localhost" in dev) — continue; org-scoped
        // routes are authorized via :orgId + authorizeMembership.
        return next();
    } catch (err) {
        return next(err);
    }
}
