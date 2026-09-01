/** Valoración que un usuario deja a otro tras una transacción sobre un anuncio concreto. */
export interface ReviewResponse {
  id: string;
  listingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

/**
 * Datos para dejar una valoración. El backend la rechaza si no existe una transacción
 * confirmada sobre ese listing entre ambos usuarios, o si ya existe una reseña previa
 * del mismo reviewer hacia el mismo reviewee para ese listing.
 */
export interface CreateReviewRequest {
  listingId: string;
  revieweeId: string;
  rating: number; // 1-5
  comment: string;
}
