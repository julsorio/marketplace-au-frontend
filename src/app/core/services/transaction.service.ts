import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TransactionResponse, ReserveTransactionRequest } from '../models/transaction.model';
import { PaymentIntentResponse } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/transactions`;

  // Vendedor (reserva para un comprador, solo en efectivo) o comprador ("Comprar"). Con tarjeta
  // solo puede reservar el comprador; el importe lo pone el backend con el precio del anuncio.
  reserve(request: ReserveTransactionRequest): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/reserve`, request);
  }

  // Solo comprador, mientras la transacción está 'awaiting_payment'.
  getPaymentIntent(id: string): Observable<PaymentIntentResponse> {
    return this.http.post<PaymentIntentResponse>(`${this.apiUrl}/${id}/payment-intent`, {});
  }

  // Solo vendedor, compra con tarjeta ya pagada ('awaiting_acceptance').
  accept(id: string): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/${id}/accept`, {});
  }

  // Solo vendedor, compra aceptada con envío.
  ship(id: string, trackingNumber: string): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/${id}/ship`, { trackingNumber });
  }

  // Solo comprador: confirma que recibió el artículo y se libera el pago al vendedor.
  confirmReceipt(id: string): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/${id}/received`, {});
  }

  // Solo vendedor, y solo para paymentMethod 'in_person' (con tarjeta la venta se completa al
  // confirmar el comprador la recepción).
  confirm(id: string): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/${id}/confirm`, {});
  }

  // Efectivo: comprador o vendedor mientras está pendiente. Tarjeta: cualquiera antes de pagar;
  // después solo el vendedor y hasta registrar el envío (con reembolso íntegro).
  cancel(id: string): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/${id}/cancel`, {});
  }

  getPurchases(): Observable<TransactionResponse[]> {
    return this.http.get<TransactionResponse[]>(`${this.apiUrl}/purchases`);
  }

  getSales(): Observable<TransactionResponse[]> {
    return this.http.get<TransactionResponse[]>(`${this.apiUrl}/sales`);
  }
}
