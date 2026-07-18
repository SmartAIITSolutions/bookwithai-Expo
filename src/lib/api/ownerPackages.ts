import { ownerFetch } from './ownerApi';

export interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  included_visits: number;
  included_service_ids: string[] | null;
  expires_after_days: number | null;
  active: boolean;
}

export async function listServicePackages() {
  return ownerFetch<{ data: ServicePackage[] }>('/api/owner/service-packages');
}

export async function createServicePackage(pkg: {
  name: string; description?: string; price_cents: number; included_visits: number;
  included_service_ids?: string[] | null; expires_after_days?: number | null;
}) {
  return ownerFetch('/api/owner/service-packages', { method: 'POST', body: pkg });
}

export async function updateServicePackage(id: string, patch: Partial<Pick<ServicePackage, 'name' | 'description' | 'included_service_ids' | 'active'>>) {
  return ownerFetch(`/api/owner/service-packages/${id}`, { method: 'PATCH', body: patch });
}

export interface CustomerServicePackage {
  id: string;
  package_id: string;
  visits_remaining: number;
  purchased_at: string;
  expires_at: string | null;
  service_packages: { name: string; included_visits: number; included_service_ids: string[] | null } | null;
}

export async function listCustomerPackages(customerId: string) {
  return ownerFetch<{ data: CustomerServicePackage[] }>(`/api/owner/customers/${customerId}/service-packages`);
}

export async function purchaseServicePackage(customerId: string, packageId: string) {
  return ownerFetch(`/api/owner/customers/${customerId}/service-packages`, { method: 'POST', body: { package_id: packageId } });
}

export async function redeemPackageVisit(customerId: string, purchaseId: string) {
  return ownerFetch<{ data: { visits_remaining: number } }>(`/api/owner/customers/${customerId}/service-packages/${purchaseId}/redeem`, { method: 'POST' });
}
