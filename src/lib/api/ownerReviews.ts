import { ownerFetch } from './ownerApi';

export interface OwnerReview {
  id: string;
  stars: number;
  review_text: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  customer: { id: string; name: string } | null;
}

export async function listOwnerReviews() {
  return ownerFetch<{ data: OwnerReview[] }>('/api/owner/reviews');
}
