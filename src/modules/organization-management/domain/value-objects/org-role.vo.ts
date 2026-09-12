export const ORG_ROLES = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

const ROLE_RANK: Record<OrgRole, number> = {
    VIEWER: 0,
    MEMBER: 1,
    ADMIN: 2,
    OWNER: 3,
};

export function isOrgRole(value: string): value is OrgRole {
    return (ORG_ROLES as readonly string[]).includes(value);
}

export function hasMinimumRole(current: OrgRole, minimum: OrgRole): boolean {
    return ROLE_RANK[current] >= ROLE_RANK[minimum];
}
