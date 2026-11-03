import { api } from "./api";
export type ProductReview = { id: string; product: string; rating: number; comment: string; author: string; created: string; updated: string; mine: boolean; status: "visible" | "hidden"; photos: string[] };
export type ReviewPage = { reviews: ProductReview[]; total: number; average: number | null; more: boolean; mine: ProductReview | null; authenticated: boolean; blocked_count: number };
export const readReviews = (product: string, page = 1) => api<ReviewPage>("product-reviews", undefined, { product, page });
export function reviewPhotoUrl(path: string) {
  if (!/^\/api\/index\.php\?action=review-photo&id=[a-f0-9]{32}$/.test(path)) return "";
  return (process.env.EXPO_PUBLIC_API_ORIGIN || "https://gostore.mn") + path;
}
