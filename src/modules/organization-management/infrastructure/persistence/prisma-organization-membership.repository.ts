import { prisma } from '@db/client';
import type {
    OrganizationMembership as PrismaOrganizationMembership,
    OrgRole as PrismaOrgRole,
} from '@generated/prisma/client';
import { OrganizationMembership } from '../../domain/entities/organization-membership.entity';
import { OrgRole, isOrgRole } from '../../domain/value-objects/org-role.vo';
import { OrganizationMembershipRepositoryPort } from '../../domain/ports/organization-membership.repository.port';
import { translatePrismaError } from './prisma-errors';

export class PrismaOrganizationMembershipRepository implements OrganizationMembershipRepositoryPort {
    async findById(id: string): Promise<OrganizationMembership | null> {
        const raw = await prisma.organizationMembership.findUnique({ where: { id } });
        return raw ? this.toDomain(raw) : null;
    }

    async findByOrganizationAndUser(
        organizationId: string,
        userId: string,
    ): Promise<OrganizationMembership | null> {
        const raw = await prisma.organizationMembership.findUnique({
            where: { organizationId_userId: { organizationId, userId } },
        });
        return raw ? this.toDomain(raw) : null;
    }

    async listByOrganization(organizationId: string): Promise<OrganizationMembership[]> {
        const raws = await prisma.organizationMembership.findMany({
            where: { organizationId },
            orderBy: { joinedAt: 'asc' },
        });
        return raws.map((raw) => this.toDomain(raw));
    }

    async listByUser(userId: string): Promise<OrganizationMembership[]> {
        const raws = await prisma.organizationMembership.findMany({
            where: { userId },
            orderBy: { joinedAt: 'asc' },
        });
        return raws.map((raw) => this.toDomain(raw));
    }

    async create(membership: OrganizationMembership): Promise<OrganizationMembership> {
        try {
            const raw = await prisma.organizationMembership.create({
                data: {
                    id: membership.id,
                    organizationId: membership.organizationId,
                    userId: membership.userId,
                    role: this.toPersistenceRole(membership.role),
                },
            });
            return this.toDomain(raw);
        } catch (err) {
            throw translatePrismaError(err);
        }
    }

    async save(membership: OrganizationMembership): Promise<void> {
        try {
            await prisma.organizationMembership.update({
                where: { id: membership.id },
                data: { role: this.toPersistenceRole(membership.role) },
            });
        } catch (err) {
            throw translatePrismaError(err);
        }
    }

    async deleteById(id: string): Promise<void> {
        await prisma.organizationMembership.delete({ where: { id } });
    }

    private toPersistenceRole(role: OrgRole): PrismaOrgRole {
        return role; // domain union and Prisma enum share the same string values
    }

    private toDomain(raw: PrismaOrganizationMembership): OrganizationMembership {
        return OrganizationMembership.restore({
            id: raw.id,
            organizationId: raw.organizationId,
            userId: raw.userId,
            role: isOrgRole(raw.role) ? raw.role : 'MEMBER',
            joinedAt: raw.joinedAt,
        });
    }
}
