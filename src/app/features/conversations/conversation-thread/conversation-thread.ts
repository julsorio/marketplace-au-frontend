import {
  Component,
  OnInit,
  signal,
  inject,
  computed,
  effect,
  DestroyRef,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { timer, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConversationService } from '../../../core/services/conversation.service';
import { ListingService } from '../../../core/services/listing.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { MessageResponse } from '../../../core/models/conversation.model';

const POLL_INTERVAL_MS = 5000;

@Component({
  selector: 'app-conversation-thread',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './conversation-thread.html',
  styleUrl: './conversation-thread.scss'
})
export class ConversationThread implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly conversationService = inject(ConversationService);
  private readonly listingService = inject(ListingService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('messagesContainer') private messagesContainerRef?: ElementRef<HTMLDivElement>;

  readonly conversationId = signal<string | null>(null);
  readonly listingId = signal<string | null>(null);
  readonly recipientId = signal<string | null>(null);

  readonly listingTitle = signal<string>('');
  readonly otherParticipantName = signal<string>('');
  readonly messages = signal<MessageResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isSending = signal(false);

  readonly myId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly messageForm = this.fb.group({
    text: ['', [Validators.required]]
  });

  constructor() {
    // Cada vez que llegan mensajes nuevos, bajamos el scroll al último
    effect(() => {
      this.messages();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.conversationId.set(id);
      this.loadExistingConversation(id);
      return;
    }

    // Sin id de conversación: venimos de "Contactar al vendedor" con listingId/recipientId
    // por query params. La conversación no existe todavía; se crea con el primer mensaje.
    const listingId = this.route.snapshot.queryParamMap.get('listingId');
    const recipientId = this.route.snapshot.queryParamMap.get('recipientId');

    if (!listingId || !recipientId) {
      this.snackBar.open('Faltan datos para iniciar la conversación', 'Cerrar', { duration: 4000 });
      this.router.navigate(['/conversations']);
      return;
    }

    this.listingId.set(listingId);
    this.recipientId.set(recipientId);
    this.loadHeaderInfo(listingId, recipientId);
    this.isLoading.set(false); // no hay mensajes que cargar todavía
  }

  private loadExistingConversation(id: string): void {
    this.conversationService.getConversation(id).subscribe({
      next: (conversation) => {
        this.listingId.set(conversation.listingId);
        const otherId = conversation.participants.find((p) => p !== this.myId())
          ?? conversation.participants[0];
        this.recipientId.set(otherId);
        this.loadHeaderInfo(conversation.listingId, otherId);
        this.startPolling(id);
      },
      error: () => {
        this.snackBar.open('No se pudo cargar la conversación', 'Cerrar', { duration: 4000 });
        this.isLoading.set(false);
        this.router.navigate(['/conversations']);
      }
    });
  }

  private loadHeaderInfo(listingId: string, recipientId: string): void {
    this.listingService.getById(listingId).subscribe({
      next: (listing) => this.listingTitle.set(listing.title),
      error: () => this.listingTitle.set('Anuncio no disponible')
    });

    this.userService.getPublicProfile(recipientId).subscribe({
      next: (user) => this.otherParticipantName.set(user.displayName),
      error: () => this.otherParticipantName.set('Usuario')
    });
  }

  // Polling en vez de WebSocket (decisión de diseño del módulo de conversaciones):
  // cada POLL_INTERVAL_MS volvemos a pedir los mensajes de la conversación mientras el
  // componente esté vivo; takeUntilDestroyed corta el polling al salir de la pantalla.
  //
  // catchError va DENTRO del switchMap (no en el subscribe): un error en getMessages() sin
  // capturar se propaga por el switchMap y termina todo el observable, incluido el timer —
  // el polling se paraba para siempre tras un solo fallo puntual de red, hasta salir y volver
  // a entrar a la conversación. Con el error atrapado aquí, ese tick se salta (se conservan
  // los mensajes que ya había) y el timer sigue emitiendo con normalidad en el siguiente ciclo.
  private startPolling(conversationId: string): void {
    timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.conversationService.getMessages(conversationId).pipe(catchError(() => of(null)))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((messages) => {
        if (messages !== null) {
          this.messages.set(messages);
        }
        this.isLoading.set(false);
      });
  }

  onSend(): void {
    if (this.messageForm.invalid) {
      return;
    }

    const text = (this.messageForm.value.text ?? '').trim();
    const listingId = this.listingId();
    const recipientId = this.recipientId();
    if (!text || !listingId || !recipientId) {
      return;
    }

    this.isSending.set(true);
    this.conversationService.sendMessage({ listingId, recipientId, text }).subscribe({
      next: (message) => {
        this.isSending.set(false);
        this.messageForm.reset();

        if (!this.conversationId()) {
          // Primer mensaje de una conversación nueva: ya existe de verdad en el backend.
          // "/conversations/new" y "/conversations/:id" son rutas distintas aunque compartan
          // componente, así que Angular recrea el componente al navegar entre ellas —
          // ngOnInit vuelve a ejecutarse con el id real y arranca el polling por su cuenta.
          this.router.navigate(['/conversations', message.conversationId], { replaceUrl: true });
        } else {
          // lo añadimos ya mismo, sin esperar al siguiente ciclo de polling
          this.messages.update((msgs) => [...msgs, message]);
        }
      },
      error: () => {
        this.isSending.set(false);
        this.snackBar.open('No se pudo enviar el mensaje', 'Cerrar', { duration: 4000 });
      }
    });
  }

  private scrollToBottom(): void {
    const el = this.messagesContainerRef?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
