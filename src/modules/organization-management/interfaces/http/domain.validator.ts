import { z } from 'zod';
import { registry } from '@common/openapi/registry';
import { orgIdParamsSchema } from './organization.validator';
import { RESERVED_SUBDOMAINS } from '../../domain/value-objects/subdomain.vo';

const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,61})[a-z0-9]$/;
const FQDN_REGEX =
    /^(?=.{4,253}$)(?![\d.]+$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/;

export const updateSubdomainSchema = z.object({
    params: z.object({
        orgId: z.uuid({ message: 'Invalid organization ID format' }),
    }),
    body: z.object({
        subdomain: z
            .string()
            .trim()
            .toLowerCase()
            .regex(
                SUBDOMAIN_REGEX,
                'Subdomain must be 3-63 chars of lowercase letters, numbers, and hyphens (not starting/ending with a hyphen).',
            )
            .refine((value) => !RESERVED_SUBDOMAINS.has(value), {
                message: 'This subdomain is reserved and cannot be used.',
            }),
    }),
});

export const requestCustomDomainSchema = z.object({
    params: z.object({
        orgId: z.uuid({ message: 'Invalid organization ID format' }),
    }),
    body: z.object({
        domain: z
            .string()
            .trim()
            .toLowerCase()
            .regex(FQDN_REGEX, 'Custom domain must be a valid FQDN, e.g. "app.acme.com".')
            .refine((value) => !value.startsWith('*'), {
                message: 'Wildcard domains are not allowed.',
            }),
    }),
});

export const verifyCustomDomainParamsSchema = z.object({
    params: z.object({
        orgId: z.uuid({ message: 'Invalid organization ID format' }),
    }),
});

export type UpdateSubdomainDto = z.infer<typeof updateSubdomainSchema>['body'];
export type RequestCustomDomainDto = z.infer<typeof requestCustomDomainSchema>['body'];

// ==========================================
// OpenAPI registration
// ==========================================

registry.registerPath({
    method: 'patch',
    path: '/api/organizations/{orgId}/domain',
    tags: ['Organization'],
    summary: 'Change the organization subdomain (OWNER/ADMIN)',
    security: [{ bearerAuth: [] }],
    request: {
        params: updateSubdomainSchema.shape.params,
        body: { content: { 'application/json': { schema: updateSubdomainSchema.shape.body } } },
    },
    responses: {
        200: { description: 'Subdomain updated' },
        409: { description: 'Subdomain already in use' },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/organizations/{orgId}/custom-domain',
    tags: ['Organization'],
    summary: 'Request a custom domain and receive a DNS TXT verification token',
    security: [{ bearerAuth: [] }],
    request: {
        params: requestCustomDomainSchema.shape.params,
        body: { content: { 'application/json': { schema: requestCustomDomainSchema.shape.body } } },
    },
    responses: {
        200: { description: 'TXT record to publish' },
        409: { description: 'Domain already registered' },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/organizations/{orgId}/custom-domain/verify',
    tags: ['Organization'],
    summary: 'Verify the TXT record and activate the custom domain',
    security: [{ bearerAuth: [] }],
    request: { params: verifyCustomDomainParamsSchema.shape.params },
    responses: {
        200: { description: 'Custom domain activated' },
        409: { description: 'TXT record not found or not propagated yet' },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/organizations/{orgId}/custom-domain',
    tags: ['Organization'],
    summary: 'Remove the custom domain (tenant reverts to subdomain)',
    security: [{ bearerAuth: [] }],
    request: { params: orgIdParamsSchema.shape.params },
    responses: {
        200: { description: 'Custom domain removed' },
        404: { description: 'No custom domain set' },
    },
});
