import { ownerFetch } from './ownerApi';

export interface CustomerLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export async function searchCustomers(q: string) {
  return ownerFetch<{ data: CustomerLite[] }>(`/api/owner/customers?q=${encodeURIComponent(q)}`);
}

export async function quickCreateCustomer(name: string, phone?: string) {
  return ownerFetch<{ data: CustomerLite }>('/api/owner/customers', { method: 'POST', body: { name, phone } });
}
