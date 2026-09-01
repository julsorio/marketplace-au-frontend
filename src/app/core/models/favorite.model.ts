import { ListingResponse } from './listing.model';

/** Un anuncio marcado como favorito por el usuario autenticado, con la fecha en que lo marcó. */
export interface FavoriteResponse {
  listing: ListingResponse;
  favoritedAt: string;
}
