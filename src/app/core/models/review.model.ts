export interface ReviewResponse {
  id: string;
  listingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface CreateReviewRequest {
  listingId: string;
  revieweeId: string;
  rating: number; // 1-5
  comment: string;
}
