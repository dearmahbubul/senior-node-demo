import { Organization } from '../entities/organization.entity';

export interface OrganizationRepositoryPort {
    findById(id: string): Promise<Organization | null>;
    findBySlug(slug: string): Promise<Organization | null>;
    findBySubdomain(subdomain: string): Promise<Organization | null>;
    findByCustomDomain(customDomain: string): Promise<Organization | null>;
    create(organization: Organization): Promise<void>;
    save(organization: Organization): Promise<void>;
    delete(id: string): Promise<void>;
}
