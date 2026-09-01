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

/**
 * Hilo de una conversación entre comprador y vendedor sobre un anuncio.
 *
 * Este mismo componente sirve dos escenarios, distinguidos en `ngOnInit`:
 * - Conversación existente: la ruta trae `:id` y se cargan los mensajes ya guardados.
 * - Conversación nueva: se llega desde "Contactar al vendedor" con `listingId`/`recipientId`
 *   por query params ("/conversations/new"), y la conversación aún no existe en el backend —
 *   se crea con el primer mensaje enviado.
 *
 * Mientras hay una conversación existente cargada, los mensajes se refrescan por polling (no
 * WebSocket) cada `POLL_INTERVAL_MS`; ver `startPolling()`.
 */
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

  /**
   * Registra el autoscroll del hilo: cada vez que `messages` cambia (llega un mensaje nuevo, ya
   * sea por polling o por envío propio), baja el scroll del contenedor hasta el final en el
   * siguiente microtask (para esperar a que la vista se haya actualizado con los mensajes
   * nuevos antes de medir `scrollHeight`).
   */
  constructor() {
    effect(() => {
      this.messages();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  /**
   * Determina si el hilo corresponde a una conversación existente (`:id` en la ruta) o a una
   * nueva (query params `listingId`/`recipientId` desde "Contactar al vendedor") y prepara la
   * pantalla en consecuencia.
   *
   * Para una conversación nueva, valida que falten los datos mínimos o que el destinatario no
   * sea el propio usuario: el botón "Contactar al vendedor" ya está oculto para el dueño del
   * anuncio, pero esta pantalla también es alcanzable escribiendo la URL a mano
   * (`?recipientId=<mi propio id>`), y el backend igualmente lo rechaza — este aviso evita que
   * el usuario llegue hasta el formulario de mensaje solo para encontrarse el error al enviar.
   */
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.conversationId.set(id);
      this.loadExistingConversation(id);
      return;
    }

    const listingId = this.route.snapshot.queryParamMap.get('listingId');
    const recipientId = this.route.snapshot.queryParamMap.get('recipientId');

    if (!listingId || !recipientId) {
      this.snackBar.open('Faltan datos para iniciar la conversación', 'Cerrar', { duration: 4000 });
      this.router.navigate(['/conversations']);
      return;
    }

    if (recipientId === this.myId()) {
      this.snackBar.open('No puedes enviarte un mensaje a ti mismo', 'Cerrar', { duration: 4000 });
      this.router.navigate(['/conversations']);
      return;
    }

    this.listingId.set(listingId);
    this.recipientId.set(recipientId);
    this.loadHeaderInfo(listingId, recipientId);
    this.isLoading.set(false); // no hay mensajes que cargar todavía
  }

  /**
   * Carga una conversación existente, resuelve quién es "el otro participante" y arranca el
   * polling de mensajes.
   *
   * @param id Id de la conversación a cargar.
   */
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

  /**
   * Carga el título del anuncio y el nombre del otro participante para la cabecera del hilo.
   *
   * @param listingId Id del anuncio asociado a la conversación.
   * @param recipientId Id del otro participante de la conversación.
   */
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

  /**
   * Arranca el polling de mensajes de la conversación: cada `POLL_INTERVAL_MS` vuelve a pedir
   * los mensajes mientras el componente esté vivo (decisión de diseño del módulo de
   * conversaciones — polling en vez de WebSocket). `takeUntilDestroyed` corta el polling al
   * salir de la pantalla.
   *
   * El `catchError` va dentro del `switchMap` (no en el `subscribe`) a propósito: un error de
   * `getMessages()` sin capturar ahí se propagaría por el `switchMap` y terminaría todo el
   * observable, incluido el `timer` — el polling se pararía para siempre tras un solo fallo
   * puntual de red, hasta salir y volver a entrar a la conversación. Con el error atrapado
   * aquí, ese tick se salta (se conservan los mensajes que ya había) y el `timer` sigue
   * emitiendo con normalidad en el siguiente ciclo.
   *
   * @param conversationId Id de la conversación cuyos mensajes se van a sondear.
   */
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

  /**
   * Envía el mensaje del formulario. Si la conversación aún no existía (caso "nueva
   * conversación"), navega a la ruta con el `:id` real devuelto por el backend en vez de
   * añadir el mensaje localmente: "/conversations/new" y "/conversations/:id" son rutas
   * distintas aunque compartan componente, así que Angular recrea el componente al navegar
   * entre ellas — `ngOnInit` vuelve a ejecutarse con el id real y arranca el polling por su
   * cuenta. Si la conversación ya existía, el mensaje se añade de inmediato a `messages`, sin
   * esperar al siguiente ciclo de polling.
   */
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
          this.router.navigate(['/conversations', message.conversationId], { replaceUrl: true });
        } else {
          this.messages.update((msgs) => [...msgs, message]);
        }
      },
      error: (err) => {
        this.isSending.set(false);
        const message = err?.error?.message ?? 'No se pudo enviar el mensaje';
        this.snackBar.open(message, 'Cerrar', { duration: 4000 });
      }
    });
  }

  /**
   * Desplaza el contenedor de mensajes hasta el final, si ya está renderizado en el DOM.
   */
  private scrollToBottom(): void {
    const el = this.messagesContainerRef?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
