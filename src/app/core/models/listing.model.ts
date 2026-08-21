export interface Price {
  amount: number;
  currency: string;
  negotiable: boolean;
}

export interface ListingResponse {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  negotiable: boolean;
  category: string;
  subcategory: string;
  condition: string;
  images: string[];
  suburb: string;
  state: string;
  latitude: number;
  longitude: number;
  status: string;
  views: number;
  favoritesCount: number;
  createdAt: string;
}

export interface CreateListingRequest {
  title: string;
  description: string;
  price: number;
  negotiable: boolean;
  category: string;
  subcategory: string;
  condition: string;
  attributes: Record<string, unknown>;
  images: string[];
  latitude: number;
  longitude: number;
  suburb: string;
  state: string;
}

export interface UpdateListingRequest {
  title: string;
  description: string;
  price: number;
  negotiable: boolean;
  category: string;
  subcategory: string;
  condition: string;
  attributes: Record<string, unknown>;
  images: string[];
}

export interface ListingSearchParams {
  category?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  state?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  query?: string;
  page?: number;
  size?: number;
}

export const LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair'] as const;
export type ListingCondition = typeof LISTING_CONDITIONS[number];