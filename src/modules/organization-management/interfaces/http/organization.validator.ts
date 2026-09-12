import { z } from 'zod';
import { registry } from '@common/openapi/registry';

export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export const orgIdParamsSchema = z.object({
    params: z.object({
        orgId: z.uuid({ message: 'Invalid organization ID format' }),
    }),
});

export const memberParamsSchema = z.object({
    params: z.object({
        orgId: z.uuid({ message: 'Invalid organization ID format' }),
        userId: z.uuid({ message: 'Invalid user ID format' }),
    }),
});

export const createOrganizationSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
        slug: z
            .string()
            .trim()
            .min(3, 'Slug must be at least 3 characters')
            .max(60, 'Slug must be at most 60 characters')
            .regex(SLUG_REGEX, 'Slug may only contain lowercase letters, numbers, and hyphens.')
            .optional(),
    }),
});

export const updateOrganizationSchema = z.object({
    params: z.object({
        orgId: z.uuid({ message: 'Invalid organization ID format' }),
    }),
    body: z
        .object({
            name: z
                .string()
                .trim()
                .min(1, 'Name is required')
                .max(200, 'Name is too long')
                .optional(),
            slug: z
                .string()
                .trim()
                .min(3, 'Slug must be at least 3 characters')
                .max(60, 'Slug must be at most 60 characters')
                .regex(SLUG_REGEX, 'Slug may only contain lowercase letters, numbers, and hyphens.')
                .optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: 'At least one field (name or slug) must be provided.',
        }),
});

export const addMemberSchema = z.object({
    params: z.object({
        orgId: z.uuid({ message: 'Invalid organization ID format' }),
    }),
    body: z.object({
        userId: z.uuid({ message: 'Invalid user ID format' }),
        role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
    }),
});

export const updateMemberRoleSchema = z.object({
    params: z.object({
        orgId: z.uuid({ message: 'Invalid organization ID format' }),
        userId: z.uuid({ message: 'Invalid user ID format' }),
    }),
    body: z.object({
        role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
    }),
});

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>['body'];
export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>['body'];
export type OrgIdParamsDto = z.infer<typeof orgIdParamsSchema>['params'];
export type MemberParamsDto = z.infer<typeof memberParamsSchema>['params'];
export type AddMemberDto = z.infer<typeof addMemberSchema>['body'];
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>['body'];

// ==========================================
// OpenAPI registration
// ==========================================

registry.registerPath({
    method: 'post',
    path: '/api/organizations',
    tags: ['Organization'],
    summary: 'Create an organization (first user becomes OWNER)',
    security: [{ bearerAuth: [] }],
    request: {
        body: { content: { 'application/json': { schema: createOrganizationSchema.shape.body } } },
    },
    responses: {
        201: { description: 'Organization created' },
        409: { description: 'Slug already in use' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/organizations',
    tags: ['Organization'],
    summary: "List the caller's organizations",
    security: [{ bearerAuth: [] }],
    responses: { 200: { description: 'List of organizations' } },
});

registry.registerPath({
    method: 'get',
    path: '/api/organizations/{orgId}',
    tags: ['Organization'],
    summary: 'Get organization detail + membership',
    security: [{ bearerAuth: [] }],
    request: { params: orgIdParamsSchema.shape.params },
    responses: { 200: { description: 'Organization details' }, 404: { description: 'Not found' } },
});

registry.registerPath({
    method: 'patch',
    path: '/api/organizations/{orgId}',
    tags: ['Organization'],
    summary: 'Update organization name/slug (OWNER/ADMIN)',
    security: [{ bearerAuth: [] }],
    request: {
        params: updateOrganizationSchema.shape.params,
        body: { content: { 'application/json': { schema: updateOrganizationSchema.shape.body } } },
    },
    responses: {
        200: { description: 'Organization updated' },
        403: { description: 'Insufficient role' },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/organizations/{orgId}',
    tags: ['Organization'],
    summary: 'Delete organization (OWNER only)',
    security: [{ bearerAuth: [] }],
    request: { params: orgIdParamsSchema.shape.params },
    responses: {
        200: { description: 'Organization deleted' },
        403: { description: 'Insufficient role' },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/organizations/{orgId}/members',
    tags: ['Organization'],
    summary: 'Add a member (OWNER/ADMIN)',
    security: [{ bearerAuth: [] }],
    request: {
        params: addMemberSchema.shape.params,
        body: { content: { 'application/json': { schema: addMemberSchema.shape.body } } },
    },
    responses: {
        201: { description: 'Member added' },
        409: { description: 'Member already exists' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/organizations/{orgId}/members',
    tags: ['Organization'],
    summary: 'List members and roles',
    security: [{ bearerAuth: [] }],
    request: { params: orgIdParamsSchema.shape.params },
    responses: { 200: { description: 'List of members' } },
});

registry.registerPath({
    method: 'patch',
    path: '/api/organizations/{orgId}/members/{userId}',
    tags: ['Organization'],
    summary: 'Change a member role (OWNER/ADMIN)',
    security: [{ bearerAuth: [] }],
    request: {
        params: updateMemberRoleSchema.shape.params,
        body: { content: { 'application/json': { schema: updateMemberRoleSchema.shape.body } } },
    },
    responses: { 200: { description: 'Role updated' }, 409: { description: 'Owner constraints' } },
});

registry.registerPath({
    method: 'delete',
    path: '/api/organizations/{orgId}/members/{userId}',
    tags: ['Organization'],
    summary: 'Remove a member (OWNER, or self)',
    security: [{ bearerAuth: [] }],
    request: { params: memberParamsSchema.shape.params },
    responses: {
        200: { description: 'Member removed' },
        403: { description: 'Insufficient role' },
    },
});
