// Ciclo de estados (ver TransactionStatus en el backend):
// - Efectivo: 'pending' → 'confirmed' | 'cancelled'
// - Tarjeta: 'awaiting_payment' → 'awaiting_acceptance' → 'accepted' → ('shipped', solo con envío)
//   → 'confirmed', o 'cancelled' (con reembolso si ya se había pagado)
export type TransactionStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'awaiting_acceptance'
  | 'accepted'
  | 'shipped'
  | 'confirmed'
  | 'cancelled';

export type PaymentMethod = 'card' | 'in_person';
export type DeliveryType = 'shipping' | 'in_person';

export interface TransactionResponse {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType | null; // null en transacciones anteriores a la integración con Stripe
  status: TransactionStatus;
  platformFee: number;
  trackingNumber: string | null;
  createdAt: string;
  paidAt: string | null;
  acceptedAt: string | null;
  shippedAt: string | null;
  confirmedAt: string | null;
  paymentExpiresAt: string | null;
  acceptDeadline: string | null;
  shipDeadline: string | null;
  autoConfirmAt: string | null;
}

// Sin importe: el backend usa siempre el precio actual del anuncio.
export interface ReserveTransactionRequest {
  listingId: string;
  buyerId: string;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
}

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pendiente',
  awaiting_payment: 'Pendiente de pago',
  awaiting_acceptance: 'Pendiente de aceptación',
  accepted: 'Aceptada',
  shipped: 'Enviada',
  confirmed: 'Completada',
  cancelled: 'Cancelada'
};
