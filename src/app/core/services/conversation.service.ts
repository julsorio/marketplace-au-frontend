import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ConversationResponse, MessageResponse, SendMessageRequest } from '../models/conversation.model';

const UNREAD_POLL_INTERVAL_MS = 20000;

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

  // Suma de unreadCount de todas las conversaciones del usuario, para el badge del Navbar.
  readonly unreadCount = signal(0);
  private unreadPollingStarted = false;

  /**
   * Arranca el polling del contador de mensajes no leídos (`unreadCount`), sumando el
   * unreadCount de todas las conversaciones del usuario para pintar el badge del Navbar.
   * Debe llamarse la primera vez que hay sesión iniciada (ver Navbar); es idempotente
   * —llamarlo varias veces no arranca polling adicional— y, al igual que el propio Navbar,
   * vive durante toda la sesión de la app en vez de pararse/reanudarse por pantalla.
   */
  ensureUnreadPolling(): void {
    if (this.unreadPollingStarted) {
      return;
    }
    this.unreadPollingStarted = true;

    timer(0, UNREAD_POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.authService.isAuthenticated()
            ? this.getConversations().pipe(catchError(() => of([] as ConversationResponse[])))
            : of([] as ConversationResponse[])
        )
      )
      .subscribe((conversations) =>
        this.unreadCount.set(conversations.reduce((sum, c) => sum + c.unreadCount, 0))
      );
  }

  /**
   * Pone a cero el contador de mensajes no leídos en memoria (sin afectar al backend).
   */
  resetUnreadCount(): void {
    this.unreadCount.set(0);
  }

  /**
   * Envía un mensaje dentro de una conversación.
   * @param request Datos del mensaje a enviar (conversación destino, texto, etc.).
   * @returns Observable que emite el mensaje creado.
   */
  sendMessage(request: SendMessageRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/messages`, request);
  }

  /**
   * Obtiene todas las conversaciones del usuario autenticado.
   * @returns Observable que emite el listado de conversaciones.
   */
  getConversations(): Observable<ConversationResponse[]> {
    return this.http.get<ConversationResponse[]>(`${this.apiUrl}/conversations`);
  }

  /**
   * Obtiene una conversación concreta por id.
   * @param id Id de la conversación.
   * @returns Observable que emite la conversación solicitada.
   */
  getConversation(id: string): Observable<ConversationResponse> {
    return this.http.get<ConversationResponse>(`${this.apiUrl}/conversations/${id}`);
  }

  /**
   * Obtiene los mensajes de una conversación.
   * @param conversationId Id de la conversación.
   * @returns Observable que emite el listado de mensajes de la conversación.
   */
  getMessages(conversationId: string): Observable<MessageResponse[]> {
    return this.http.get<MessageResponse[]>(`${this.apiUrl}/conversations/${conversationId}/messages`);
  }
}
