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

  // Arranca el polling del contador de no leídos la primera vez que hay sesión iniciada (ver
  // Navbar); es idempotente y, al igual que el propio Navbar, vive durante toda la sesión de
  // la app en vez de pararse/reanudarse por pantalla.
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

  resetUnreadCount(): void {
    this.unreadCount.set(0);
  }

  sendMessage(request: SendMessageRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/messages`, request);
  }

  getConversations(): Observable<ConversationResponse[]> {
    return this.http.get<ConversationResponse[]>(`${this.apiUrl}/conversations`);
  }

  getConversation(id: string): Observable<ConversationResponse> {
    return this.http.get<ConversationResponse>(`${this.apiUrl}/conversations/${id}`);
  }

  getMessages(conversationId: string): Observable<MessageResponse[]> {
    return this.http.get<MessageResponse[]>(`${this.apiUrl}/conversations/${conversationId}/messages`);
  }
}
