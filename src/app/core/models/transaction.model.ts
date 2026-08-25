export interface TransactionResponse {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  amount: number;
  currency: string;
  paymentMethod: string; // 'card' | 'in_person' — solo 'in_person' es funcional por ahora
  status: string; // 'pending' | 'confirmed' | 'cancelled'
  createdAt: string;
  confirmedAt: string | null;
}

export interface ReserveTransactionRequest {
  listingId: string;
  buyerId: string;
  amount: number;
  paymentMethod: string;
}
