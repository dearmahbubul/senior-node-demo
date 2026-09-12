import { Organization } from '../../domain/entities/organization.entity';
import { tenantUrlForOrganization } from '../../application/create-organization.use-case';
import { organizationResource, OrganizationResponse } from './organization.resource';

export interface TenantDomainResponse {
    organization: OrganizationResponse;
    tenantUrl: string;
}

export interface CustomDomainRequestedResponse {
    organization: OrganizationResponse;
    domain: string;
    dnsRecord: {
        recordName: string;
        recordValue: string;
    };
    note: string;
}

export const domainResource = {
    subdomainChanged(organization: Organization): TenantDomainResponse {
        return {
            organization: organizationResource.single(organization),
            tenantUrl: tenantUrlForOrganization(organization),
        };
    },

    customDomainRequested(input: {
        organization: Organization;
        recordName: string;
        recordValue: string;
    }): CustomDomainRequestedResponse {
        return {
            organization: organizationResource.single(input.organization),
            domain: input.organization.customDomain as string,
            dnsRecord: {
                recordName: input.recordName,
                recordValue: input.recordValue,
            },
            note: 'Publish this TXT record and wait for DNS propagation, then call verify.',
        };
    },

    customDomainVerified(input: {
        organization: Organization;
        customDomain: string;
        tenantUrl: string;
    }): TenantDomainResponse {
        return {
            organization: organizationResource.single(input.organization),
            tenantUrl: input.tenantUrl,
        };
    },

    customDomainRemoved(organization: Organization): TenantDomainResponse {
        return {
            organization: organizationResource.single(organization),
            tenantUrl: tenantUrlForOrganization(organization),
        };
    },
};
