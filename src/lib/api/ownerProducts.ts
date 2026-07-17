import { ownerFetch } from './ownerApi';

export interface Product {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
}

export async function listProducts() {
  return ownerFetch<{ data: Product[] }>('/api/owner/products');
}

export async function createProduct(name: string, price_cents: number) {
  return ownerFetch<{ data: Product }>('/api/owner/products', { method: 'POST', body: { name, price_cents } });
}

export async function archiveProduct(id: string) {
  return ownerFetch(`/api/owner/products/${id}`, { method: 'DELETE' });
}
