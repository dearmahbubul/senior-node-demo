import { DomainError } from '@common/errors/DomainError';
import { OrgRole, isOrgRole } from '../value-objects/org-role.vo';

export interface OrganizationMembershipProps {
    id: string;
    organizationId: string;
    userId: string;
    role: OrgRole;
    joinedAt?: Date;
}

/**
 * Links a User to an Organization with a role (OWNER/ADMIN/MEMBER/VIEWER).
 * Unique per (organizationId, userId).
 */
export class OrganizationMembership {
    public readonly id: string;
    public readonly organizationId: string;
    public readonly userId: string;
    public role: OrgRole;
    public readonly joinedAt: Date;

    protected constructor(props: OrganizationMembershipProps) {
        this.id = props.id;
        this.organizationId = props.organizationId;
        this.userId = props.userId;
        this.role = props.role;
        this.joinedAt = props.joinedAt ?? new Date();
    }

    static create(props: {
        id: string;
        organizationId: string;
        userId: string;
        role: OrgRole;
    }): OrganizationMembership {
        if (!isOrgRole(props.role)) {
            throw new DomainError(
                'INVALID_ROLE',
                `"${props.role}" is not a valid organization role.`,
            );
        }
        return new OrganizationMembership(props);
    }

    static restore(props: OrganizationMembershipProps): OrganizationMembership {
        return new OrganizationMembership(props);
    }

    changeRole(role: OrgRole): void {
        if (!isOrgRole(role)) {
            throw new DomainError('INVALID_ROLE', `"${role}" is not a valid organization role.`);
        }
        this.role = role;
    }
}
