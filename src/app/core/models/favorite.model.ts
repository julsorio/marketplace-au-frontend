import { ListingResponse } from './listing.model';

export interface FavoriteResponse {
  listing: ListingResponse;
  favoritedAt: string;
}
