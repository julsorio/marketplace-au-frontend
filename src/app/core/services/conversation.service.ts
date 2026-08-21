import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConversationResponse, MessageResponse, SendMessageRequest } from '../models/conversation.model';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

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
