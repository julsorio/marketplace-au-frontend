import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConversationService } from '../../../core/services/conversation.service';
import { ListingService } from '../../../core/services/listing.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConversationResponse } from '../../../core/models/conversation.model';

interface ConversationView {
  conversation: ConversationResponse;
  listingTitle: string;
  listingThumbnail: string | null;
  otherParticipantName: string;
}

/**
 * Bandeja de entrada de conversaciones del usuario.
 *
 * El endpoint de conversaciones solo devuelve datos mínimos (ids de anuncio y participantes),
 * así que cada conversación se enriquece con el título/imagen del anuncio y el nombre del otro
 * participante mediante `forkJoin` antes de mostrarla.
 */
@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './conversation-list.html',
  styleUrl: './conversation-list.scss'
})
export class ConversationList implements OnInit {
  private readonly conversationService = inject(ConversationService);
  private readonly listingService = inject(ListingService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);

  readonly isLoading = signal(true);
  readonly conversations = signal<ConversationView[]>([]);

  /**
   * Carga la bandeja de conversaciones al iniciar la pantalla.
   */
  ngOnInit(): void {
    this.load();
  }

  /**
   * Obtiene las conversaciones del usuario y las enriquece antes de exponerlas en el signal
   * `conversations`.
   */
  private load(): void {
    this.isLoading.set(true);

    this.conversationService.getConversations().subscribe({
      next: (conversations) => {
        if (conversations.length === 0) {
          this.conversations.set([]);
          this.isLoading.set(false);
          return;
        }

        const myId = this.authService.currentUser()?.id;
        forkJoin(conversations.map((c) => this.enrich(c, myId))).subscribe({
          next: (views) => {
            this.conversations.set(views);
            this.isLoading.set(false);
          },
          error: () => this.isLoading.set(false)
        });
      },
      error: () => this.isLoading.set(false)
    });
  }

  /**
   * Completa una conversación con el título/imagen del anuncio asociado y el nombre del otro
   * participante, ya que el endpoint de conversaciones solo trae ids (listingId, participants).
   *
   * `getById()` sin el segundo argumento no cuenta como visualización (`trackView=false` por
   * defecto) — solo la pantalla de detalle del anuncio la marca como una visita real.
   *
   * @param conversation Conversación tal como la devuelve el backend.
   * @param myId Id del usuario actual, para determinar quién es "el otro participante".
   * @returns Observable con la conversación ya enriquecida para la vista.
   */
  private enrich(conversation: ConversationResponse, myId: string | undefined): Observable<ConversationView> {
    const otherId = conversation.participants.find((p) => p !== myId) ?? conversation.participants[0];

    return forkJoin({
      listing: this.listingService.getById(conversation.listingId).pipe(catchError(() => of(null))),
      other: this.userService.getPublicProfile(otherId).pipe(catchError(() => of(null)))
    }).pipe(
      map(({ listing, other }) => ({
        conversation,
        listingTitle: listing?.title ?? 'Anuncio no disponible',
        listingThumbnail: listing?.images?.[0] ?? null,
        otherParticipantName: other?.displayName ?? 'Usuario'
      }))
    );
  }

  /**
   * Formatea una fecha ISO como fecha corta localizada (en-AU) para la lista de conversaciones.
   *
   * @param iso Fecha en formato ISO 8601, o `null` si no hay fecha disponible.
   * @returns La fecha formateada, o cadena vacía si `iso` es `null`.
   */
  formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }
}
