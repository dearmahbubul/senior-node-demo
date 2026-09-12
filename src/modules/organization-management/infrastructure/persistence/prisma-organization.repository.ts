import { prisma } from '@db/client';
import type { Organization as PrismaOrganization } from '@generated/prisma/client';
import { Organization } from '../../domain/entities/organization.entity';
import { OrganizationRepositoryPort } from '../../domain/ports/organization.repository.port';
import { translatePrismaError } from './prisma-errors';

/**
 * Prisma adapter implementing OrganizationRepositoryPort. Maps between the
 * Prisma record and the domain aggregate in both directions — the domain never
 * sees Prisma types.
 */
export class PrismaOrganizationRepository implements OrganizationRepositoryPort {
    async findById(id: string): Promise<Organization | null> {
        const raw = await prisma.organization.findUnique({ where: { id } });
        return raw ? this.toDomain(raw) : null;
    }

    async findBySlug(slug: string): Promise<Organization | null> {
        const raw = await prisma.organization.findUnique({ where: { slug } });
        return raw ? this.toDomain(raw) : null;
    }

    async findBySubdomain(subdomain: string): Promise<Organization | null> {
        const raw = await prisma.organization.findUnique({ where: { subdomain } });
        return raw ? this.toDomain(raw) : null;
    }

    async findByCustomDomain(customDomain: string): Promise<Organization | null> {
        const raw = await prisma.organization.findUnique({ where: { customDomain } });
        return raw ? this.toDomain(raw) : null;
    }

    async create(organization: Organization): Promise<void> {
        try {
            await prisma.organization.create({ data: this.toCreateData(organization) });
        } catch (err) {
            throw translatePrismaError(err);
        }
    }

    async save(organization: Organization): Promise<void> {
        try {
            await prisma.organization.update({
                where: { id: organization.id },
                data: this.toUpdateData(organization),
            });
        } catch (err) {
            throw translatePrismaError(err);
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await prisma.organization.delete({ where: { id } });
        } catch (err) {
            throw translatePrismaError(err);
        }
    }

    // Return types are inferred — these object shapes satisfy Prisma's
    // unchecked create/update inputs, which carry only scalar fields.
    private toCreateData(organization: Organization) {
        return {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            ownerId: organization.ownerId,
            subdomain: organization.subdomain,
            customDomain: organization.customDomain,
            customDomainVerificationToken: organization.customDomainVerificationToken,
            customDomainVerifiedAt: organization.customDomainVerifiedAt,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
        };
    }

    private toUpdateData(organization: Organization) {
        return {
            name: organization.name,
            slug: organization.slug,
            subdomain: organization.subdomain,
            customDomain: organization.customDomain,
            customDomainVerificationToken: organization.customDomainVerificationToken,
            customDomainVerifiedAt: organization.customDomainVerifiedAt,
            updatedAt: new Date(),
        };
    }

    private toDomain(raw: PrismaOrganization): Organization {
        return Organization.restore({
            id: raw.id,
            name: raw.name,
            slug: raw.slug,
            ownerId: raw.ownerId,
            subdomain: raw.subdomain,
            customDomain: raw.customDomain,
            customDomainVerificationToken: raw.customDomainVerificationToken,
            customDomainVerifiedAt: raw.customDomainVerifiedAt,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        });
    }
}
