import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TransactionResponse, ReserveTransactionRequest } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/transactions`;

  // Solo puede llamarlo el vendedor (dueño del listing): reserva la venta para el comprador
  // indicado. El backend valida que quien reserva sea el dueño del anuncio.
  reserve(request: ReserveTransactionRequest): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/reserve`, request);
  }

  // Solo vendedor, y solo para paymentMethod 'in_person' (con tarjeta se confirmaría vía
  // webhook cuando se integre la pasarela de pago, todavía no implementado).
  confirm(id: string): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/${id}/confirm`, {});
  }

  // Comprador o vendedor, solo mientras la transacción está pendiente.
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
