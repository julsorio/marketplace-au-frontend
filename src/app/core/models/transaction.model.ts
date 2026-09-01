/**
 * Transacción de reserva/compra de un anuncio. `confirmedAt` es null mientras el estado
 * sea `pending`; se rellena al confirmarse (o queda null para siempre si se cancela).
 */
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

/**
 * Datos para reservar un anuncio. Aunque `paymentMethod` admite `'card'`, todavía no hay
 * pasarela de pago integrada: en la práctica solo `'in_person'` completa el flujo end-to-end.
 */
export interface ReserveTransactionRequest {
  listingId: string;
  buyerId: string;
  amount: number;
  paymentMethod: string;
}
