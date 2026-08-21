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

  ngOnInit(): void {
    this.load();
  }

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

  // El endpoint de conversaciones solo trae ids (listingId, participants); aquí lo
  // completamos con el título/imagen del anuncio y el nombre del otro participante.
  // Nota: listingService.getById() incrementa el contador de visitas del anuncio (mismo
  // comportamiento que al abrir su página de detalle) — es un efecto secundario ya existente
  // en el backend, no algo nuevo de esta pantalla, pero merece revisarse más adelante.
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

  formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }
}
