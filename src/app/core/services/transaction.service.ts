import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TransactionResponse, ReserveTransactionRequest } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/transactions`;

  /**
   * Reserva la venta de un anuncio para el comprador indicado. Solo puede llamarlo el
   * vendedor (dueño del listing); el backend valida que quien reserva sea el dueño del
   * anuncio.
   * @param request Datos de la reserva (anuncio, comprador, etc.).
   * @returns Observable que emite la transacción reservada.
   */
  reserve(request: ReserveTransactionRequest): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/reserve`, request);
  }

  /**
   * Confirma una transacción. Solo puede llamarlo el vendedor, y solo para paymentMethod
   * 'in_person' (con tarjeta se confirmaría vía webhook cuando se integre la pasarela de
   * pago, todavía no implementado).
   * @param id Id de la transacción a confirmar.
   * @returns Observable que emite la transacción confirmada.
   */
  confirm(id: string): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/${id}/confirm`, {});
  }

  /**
   * Cancela una transacción. Puede llamarlo el comprador o el vendedor, y solo mientras la
   * transacción está pendiente.
   * @param id Id de la transacción a cancelar.
   * @returns Observable que emite la transacción cancelada.
   */
  cancel(id: string): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(`${this.apiUrl}/${id}/cancel`, {});
  }

  /**
   * Obtiene las transacciones en las que el usuario autenticado es comprador.
   * @returns Observable que emite el listado de compras del usuario.
   */
  getPurchases(): Observable<TransactionResponse[]> {
    return this.http.get<TransactionResponse[]>(`${this.apiUrl}/purchases`);
  }

  /**
   * Obtiene las transacciones en las que el usuario autenticado es vendedor.
   * @returns Observable que emite el listado de ventas del usuario.
   */
  getSales(): Observable<TransactionResponse[]> {
    return this.http.get<TransactionResponse[]>(`${this.apiUrl}/sales`);
  }
}
