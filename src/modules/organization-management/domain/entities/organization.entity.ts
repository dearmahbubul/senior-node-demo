import { DomainError } from '@common/errors/DomainError';
import { CustomDomain } from '../value-objects/custom-domain.vo';
import { DomainVerificationToken } from '../value-objects/domain-verification-token.vo';
import { Slug } from '../value-objects/slug.vo';
import { Subdomain } from '../value-objects/subdomain.vo';
import { SubdomainChangedEvent, subdomainChangedEvent } from '../events/subdomain-changed.event';
import {
    CustomDomainVerifiedEvent,
    customDomainVerifiedEvent,
} from '../events/custom-domain-verified.event';
import {
    CustomDomainRemovedEvent,
    customDomainRemovedEvent,
} from '../events/custom-domain-removed.event';

export interface OrganizationProps {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    subdomain: string;
    customDomain?: string | null;
    customDomainVerificationToken?: string | null;
    customDomainVerifiedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Aggregate root of the Organization Management context — a tenant / workspace.
 * Owns the tenant's domain settings: default subdomain + optional verified
 * custom domain. Row-level tenant isolation is enforced by `organizationId`.
 */
export class Organization {
    public readonly id: string;
    public name: string;
    public slug: string;
    public readonly ownerId: string;
    public subdomain: string;
    public customDomain: string | null;
    public customDomainVerificationToken: string | null;
    public customDomainVerifiedAt: Date | null;
    public readonly createdAt: Date;
    public readonly updatedAt: Date;

    protected constructor(props: OrganizationProps) {
        this.id = props.id;
        this.name = props.name;
        this.slug = props.slug;
        this.ownerId = props.ownerId;
        this.subdomain = props.subdomain;
        this.customDomain = props.customDomain ?? null;
        this.customDomainVerificationToken = props.customDomainVerificationToken ?? null;
        this.customDomainVerifiedAt = props.customDomainVerifiedAt ?? null;
        this.createdAt = props.createdAt ?? new Date();
        this.updatedAt = props.updatedAt ?? new Date();
    }

    /** Factory used when creating a brand-new aggregate (validates all inputs). */
    static create(props: {
        id: string;
        name: string;
        slug: string;
        ownerId: string;
        subdomain: string;
    }): Organization {
        const name = props.name.trim();
        if (!name) {
            throw new DomainError('INVALID_NAME', 'Organization name cannot be empty.');
        }
        return new Organization({
            ...props,
            name,
            slug: Slug.create(props.slug).value,
            subdomain: Subdomain.create(props.subdomain).value,
        });
    }

    /** Restores an aggregate from persistence — skips re-validation of stored data. */
    static restore(props: OrganizationProps): Organization {
        return new Organization(props);
    }

    updateName(name: string): void {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new DomainError('INVALID_NAME', 'Organization name cannot be empty.');
        }
        if (trimmed.length > 200) {
            throw new DomainError(
                'INVALID_NAME',
                'Organization name cannot exceed 200 characters.',
            );
        }
        this.name = trimmed;
    }

    updateSlug(slug: string): void {
        this.slug = Slug.create(slug).value;
    }

    changeSubdomain(subdomain: string): SubdomainChangedEvent {
        const next = Subdomain.create(subdomain);
        if (next.value === this.subdomain) {
            throw new DomainError(
                'SUBDOMAIN_UNCHANGED',
                'The organization already uses this subdomain.',
                { subdomain: next.value },
            );
        }
        const previousSubdomain = this.subdomain;
        this.subdomain = next.value;
        return subdomainChangedEvent({
            organizationId: this.id,
            subdomain: next.value,
            previousSubdomain,
        });
    }

    /**
     * Stages a custom domain for verification and returns the token to publish
     * as a DNS TXT record. The domain is NOT active until verifyCustomDomain
     * succeeds.
     */
    requestCustomDomain(domain: string): { token: string } {
        if (this.customDomain && this.customDomainVerifiedAt) {
            throw new DomainError(
                'CUSTOM_DOMAIN_ALREADY_ACTIVE',
                'A custom domain is already active for this organization.',
                { customDomain: this.customDomain },
            );
        }
        const customDomain = CustomDomain.create(domain);
        const token = DomainVerificationToken.generate();
        this.customDomain = customDomain.value;
        this.customDomainVerificationToken = token.value;
        this.customDomainVerifiedAt = null;
        return { token: token.value };
    }

    hasPendingCustomDomain(): boolean {
        return this.customDomain !== null && this.customDomainVerificationToken !== null;
    }

    /**
     * Activates the staged custom domain after the DNS record check succeeded.
     * Returns a CustomDomainVerifiedEvent, or null when the check failed.
     */
    verifyCustomDomain(recordFound: boolean): CustomDomainVerifiedEvent | null {
        if (!this.hasPendingCustomDomain()) {
            throw new DomainError(
                'NO_PENDING_CUSTOM_DOMAIN',
                'No custom domain is pending verification.',
            );
        }
        if (!recordFound) {
            return null;
        }
        const domain = this.customDomain as string;
        this.customDomainVerifiedAt = new Date();
        this.customDomainVerificationToken = null;
        return customDomainVerifiedEvent({ organizationId: this.id, customDomain: domain });
    }

    removeCustomDomain(): CustomDomainRemovedEvent {
        if (!this.customDomain) {
            throw new DomainError('NO_CUSTOM_DOMAIN', 'This organization has no custom domain.');
        }
        const domain = this.customDomain;
        this.customDomain = null;
        this.customDomainVerificationToken = null;
        this.customDomainVerifiedAt = null;
        return customDomainRemovedEvent({ organizationId: this.id, customDomain: domain });
    }

    tenantUrl(appBaseHost: string): string {
        return `https://${this.subdomain}.${appBaseHost}`;
    }
}
