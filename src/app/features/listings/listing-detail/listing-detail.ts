import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ListingService } from '../../../core/services/listing.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoriteService } from '../../../core/services/favorite.service';
import { ConversationService } from '../../../core/services/conversation.service';
import { UserService } from '../../../core/services/user.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { ListingResponse, DELIVERY_METHOD_LABELS } from '../../../core/models/listing.model';
import { TransactionResponse } from '../../../core/models/transaction.model';
import { UserPublicProfile } from '../../../core/models/user.model';
import { LocationMapView } from '../../../shared/components/location-map-view/location-map-view';

const STATUS_LABELS: Record<string, string> = {
  active: 'Disponible',
  reserved: 'Reservado',
  sold: 'Vendido',
  expired: 'Expirado',
  draft: 'Borrador'
};

/**
 * Pantalla de detalle de un anuncio: información completa, galería, chip de estado (ver
 * `statusLabel`), acciones del dueño (editar/eliminar) y, para quien no es el dueño, contacto
 * con el vendedor, favoritos, y los formularios de reserva/compra.
 *
 * No existe un endpoint "la transacción de este anuncio": la transacción relacionada (reserva o
 * venta) se deriva filtrando `getSales()`/`getPurchases()` por `listingId`, mismo criterio que
 * se usa para favoritos (ver `loadTransactionInfo`).
 */
@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    LocationMapView
  ],
  templateUrl: './listing-detail.html',
  styleUrl: './listing-detail.scss'
})
export class ListingDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly conversationService = inject(ConversationService);
  private readonly userService = inject(UserService);
  private readonly transactionService = inject(TransactionService);
  private readonly fb = inject(FormBuilder);
  readonly favoriteService = inject(FavoriteService);

  readonly listing = signal<ListingResponse | null>(null);
  readonly isLoading = signal(true);
  readonly notFound = signal(false);
  readonly selectedImageIndex = signal(0);
  readonly sellerProfile = signal<UserPublicProfile | null>(null);

  /**
   * Transacción (reserva/venta) relacionada con este anuncio y con el usuario actual: si es el
   * vendedor, la suya como vendedor; si es el comprador, la suya como comprador. No hay
   * endpoint para "la transacción de este listing", así que se deriva filtrando
   * `getSales()`/`getPurchases()` por `listingId` — igual criterio que se usa para favoritos.
   */
  readonly myTransaction = signal<TransactionResponse | null>(null);
  readonly buyerName = signal<string>('');
  readonly candidateBuyers = signal<{ id: string; name: string }[]>([]);
  readonly showReserveForm = signal(false);
  readonly isProcessingTransaction = signal(false);

  readonly reserveForm = this.fb.group({
    buyerId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethod: ['in_person', Validators.required]
  });

  /**
   * Formulario de compra, para cuando es el propio comprador quien hace clic en "Comprar" (en
   * vez de que sea el vendedor quien reserve la venta a su nombre).
   */
  readonly showBuyForm = signal(false);
  readonly buyForm = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethod: ['in_person', Validators.required]
  });

  /** `true` si el usuario actual es el vendedor (dueño) del anuncio mostrado. */
  readonly isOwner = computed(() => {
    const currentUser = this.authService.currentUser();
    const currentListing = this.listing();
    return !!currentUser && !!currentListing && currentUser.id === currentListing.sellerId;
  });

  /** Etiqueta en español del estado del anuncio, para el chip de estado ("Disponible", "Reservado", etc.). */
  readonly statusLabel = computed(() => {
    const l = this.listing();
    return l ? (STATUS_LABELS[l.status] ?? l.status) : '';
  });

  /** Etiqueta en español del método de entrega del anuncio. */
  readonly deliveryMethodLabel = computed(() => {
    const l = this.listing();
    return l ? (DELIVERY_METHOD_LABELS[l.deliveryMethod] ?? l.deliveryMethod) : '';
  });

  /**
   * Carga el anuncio indicado en la ruta (`:id`), su vendedor y, si el anuncio ya no está
   * disponible (reservado o vendido) y hay alguien identificado consultándolo, la transacción
   * relacionada — solo entonces tiene sentido buscarla.
   */
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    this.listingService.getById(id, true).subscribe({
      next: (result) => {
        this.listing.set(result);
        this.isLoading.set(false);
        this.loadSellerProfile(result.sellerId);

        if (result.status !== 'active' && this.authService.isAuthenticated()) {
          this.loadTransactionInfo(result);
        }
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Carga el nombre y rating del vendedor, para que un comprador pueda hacerse una idea de su
   * reputación antes de contactar o comprar. Se muestra con enlace a `/users/:id`.
   *
   * @param sellerId Id del vendedor del anuncio.
   */
  private loadSellerProfile(sellerId: string): void {
    this.userService.getPublicProfile(sellerId).subscribe({
      next: (profile) => this.sellerProfile.set(profile),
      error: () => this.sellerProfile.set(null)
    });
  }

  /**
   * Busca la transacción relacionada con este anuncio y con el usuario actual, derivándola de
   * `getSales()` (si el usuario es el vendedor) o `getPurchases()` (si es el comprador), ya que
   * no existe un endpoint dedicado para obtenerla directamente.
   *
   * @param listing Anuncio ya cargado, cuyo `id` y `sellerId` se usan para filtrar.
   */
  private loadTransactionInfo(listing: ListingResponse): void {
    const myId = this.authService.currentUser()?.id;
    if (!myId) return;

    const source = myId === listing.sellerId
      ? this.transactionService.getSales()
      : this.transactionService.getPurchases();

    source.subscribe({
      next: (transactions) => {
        const relevant = transactions
          .filter((t) => t.listingId === listing.id && t.status !== 'cancelled')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        this.setTransaction(relevant ?? null);
      },
      error: () => this.setTransaction(null)
    });
  }

  /**
   * Fija la transacción relacionada con el anuncio y, si el usuario actual es el vendedor,
   * resuelve también el nombre del comprador para mostrarlo en la pantalla.
   *
   * @param t Transacción a fijar, o `null` si no hay ninguna relacionada.
   */
  private setTransaction(t: TransactionResponse | null): void {
    this.myTransaction.set(t);

    if (t && this.isOwner()) {
      this.userService.getPublicProfile(t.buyerId).subscribe({
        next: (u) => this.buyerName.set(u.displayName),
        error: () => this.buyerName.set('Comprador')
      });
    }
  }

  /**
   * Formatea el precio del anuncio como moneda localizada (en-AU).
   *
   * @returns El precio formateado, o cadena vacía si el anuncio aún no se ha cargado.
   */
  formatPrice(): string {
    const l = this.listing();
    if (!l) return '';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: l.currency }).format(l.price);
  }

  /**
   * Selecciona la imagen mostrada en la galería principal.
   *
   * @param index Índice de la imagen a mostrar dentro del array de imágenes del anuncio.
   */
  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  /**
   * Elimina el anuncio actual, previa confirmación del usuario, y vuelve al listado.
   */
  onDelete(): void {
    const l = this.listing();
    if (!l) return;

    if (!confirm('¿Seguro que quieres eliminar este anuncio?')) return;

    this.listingService.delete(l.id).subscribe({
      next: () => {
        this.snackBar.open('Anuncio eliminado', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/listings']);
      },
      error: () => {
        this.snackBar.open('Error al eliminar el anuncio', 'Cerrar', { duration: 4000 });
      }
    });
  }

  /**
   * Inicia (o continúa) una conversación con el vendedor del anuncio, exigiendo sesión
   * iniciada.
   *
   * No hay conversación todavía en el caso general: se crea en el backend con el primer
   * mensaje. `ConversationThread` lee `listingId`/`recipientId` de los query params en ese caso.
   */
  onContactSeller(): void {
    if (!this.authService.isAuthenticated()) {
      const returnUrl = this.router.url;
      this.snackBar
        .open('Debes iniciar sesión para contactar al vendedor', 'Iniciar sesión', { duration: 5000 })
        .onAction()
        .subscribe(() => this.router.navigate(['/login'], { queryParams: { returnUrl } }));
      return;
    }

    const l = this.listing();
    if (!l) return;

    this.router.navigate(['/conversations/new'], {
      queryParams: { listingId: l.id, recipientId: l.sellerId }
    });
  }

  /**
   * Alterna el estado de favorito del anuncio, exigiendo sesión iniciada.
   */
  toggleFavorite(): void {
    const l = this.listing();
    if (!l) return;

    if (!this.authService.isAuthenticated()) {
      const returnUrl = this.router.url;
      this.snackBar
        .open('Debes iniciar sesión para guardar favoritos', 'Iniciar sesión', { duration: 5000 })
        .onAction()
        .subscribe(() => this.router.navigate(['/login'], { queryParams: { returnUrl } }));
      return;
    }

    this.favoriteService.toggle(l.id);
  }

  /**
   * Formatea el importe de una transacción como moneda localizada (en-AU).
   *
   * @param t Transacción cuyo importe se quiere formatear.
   * @returns El importe formateado como cadena de moneda.
   */
  formatAmount(t: TransactionResponse): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: t.currency }).format(t.amount);
  }

  /**
   * Abre el formulario de reserva de venta (uso del vendedor) con los valores por defecto y
   * carga los candidatos a comprador para ese anuncio.
   */
  openReserveForm(): void {
    const l = this.listing();
    if (!l) return;

    this.reserveForm.reset({ buyerId: '', amount: l.price, paymentMethod: 'in_person' });
    this.showReserveForm.set(true);
    this.loadCandidateBuyers(l.id);
  }

  /**
   * Obtiene los candidatos a comprador de este anuncio: la gente con la que el vendedor ya ha
   * hablado sobre él, ya que no hay en la app ninguna otra forma de saber el id de un posible
   * comprador. Si no hay conversaciones todavía, el campo de texto libre del formulario de
   * reserva sigue disponible como alternativa.
   *
   * @param listingId Id del anuncio para el que se buscan candidatos a comprador.
   */
  private loadCandidateBuyers(listingId: string): void {
    this.conversationService.getConversations().subscribe({
      next: (conversations) => {
        const related = conversations.filter((c) => c.listingId === listingId);
        if (related.length === 0) {
          this.candidateBuyers.set([]);
          return;
        }

        const myId = this.authService.currentUser()?.id;
        forkJoin(
          related.map((c) => {
            const otherId = c.participants.find((p) => p !== myId) ?? c.participants[0];
            return this.userService.getPublicProfile(otherId).pipe(
              map((u) => ({ id: otherId, name: u.displayName })),
              catchError(() => of({ id: otherId, name: 'Usuario' }))
            );
          })
        ).subscribe((buyers) => this.candidateBuyers.set(buyers));
      },
      error: () => this.candidateBuyers.set([])
    });
  }

  /**
   * Rellena el campo `buyerId` del formulario de reserva con el candidato a comprador elegido.
   *
   * @param id Id del candidato a comprador seleccionado.
   */
  onSelectCandidateBuyer(id: string): void {
    this.reserveForm.controls.buyerId.setValue(id);
  }

  /**
   * Envía el formulario de reserva de venta: marca el anuncio como reservado a nombre del
   * comprador elegido por el vendedor.
   */
  onReserveSubmit(): void {
    const l = this.listing();
    if (!l || this.reserveForm.invalid) return;

    const { buyerId, amount, paymentMethod } = this.reserveForm.getRawValue();
    this.isProcessingTransaction.set(true);

    this.transactionService
      .reserve({ listingId: l.id, buyerId: buyerId!, amount: amount!, paymentMethod: paymentMethod! })
      .subscribe({
        next: (transaction) => {
          this.isProcessingTransaction.set(false);
          this.showReserveForm.set(false);
          this.setTransaction(transaction);
          this.listing.update((current) => (current ? { ...current, status: 'reserved' } : current));
          this.snackBar.open('Anuncio marcado como reservado', 'Cerrar', { duration: 3000 });
        },
        error: (err) => {
          this.isProcessingTransaction.set(false);
          const message = err?.error?.message ?? 'No se pudo reservar la venta';
          this.snackBar.open(message, 'Cerrar', { duration: 4000 });
        }
      });
  }

  /**
   * Confirma la venta de la transacción reservada actual (uso del vendedor).
   */
  onConfirmSale(): void {
    const transaction = this.myTransaction();
    if (!transaction) return;

    this.isProcessingTransaction.set(true);
    this.transactionService.confirm(transaction.id).subscribe({
      next: (updated) => {
        this.isProcessingTransaction.set(false);
        this.setTransaction(updated);
        this.listing.update((current) => (current ? { ...current, status: 'sold' } : current));
        this.snackBar.open('Venta confirmada', 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        this.isProcessingTransaction.set(false);
        const message = err?.error?.message ?? 'No se pudo confirmar la venta';
        this.snackBar.open(message, 'Cerrar', { duration: 4000 });
      }
    });
  }

  /**
   * Cancela la reserva actual, previa confirmación del usuario, y devuelve el anuncio a estado
   * disponible.
   */
  onCancelTransaction(): void {
    const transaction = this.myTransaction();
    if (!transaction) return;
    if (!confirm('¿Seguro que quieres cancelar esta reserva?')) return;

    this.isProcessingTransaction.set(true);
    this.transactionService.cancel(transaction.id).subscribe({
      next: () => {
        this.isProcessingTransaction.set(false);
        this.setTransaction(null);
        this.listing.update((current) => (current ? { ...current, status: 'active' } : current));
        this.snackBar.open('Reserva cancelada', 'Cerrar', { duration: 3000 });
      },
      error: () => {
        this.isProcessingTransaction.set(false);
        this.snackBar.open('No se pudo cancelar la reserva', 'Cerrar', { duration: 4000 });
      }
    });
  }

  /**
   * Abre el formulario de compra (uso del comprador) con los valores por defecto, exigiendo
   * sesión iniciada.
   */
  openBuyForm(): void {
    const l = this.listing();
    if (!l) return;

    if (!this.authService.isAuthenticated()) {
      const returnUrl = this.router.url;
      this.snackBar
        .open('Debes iniciar sesión para comprar', 'Iniciar sesión', { duration: 5000 })
        .onAction()
        .subscribe(() => this.router.navigate(['/login'], { queryParams: { returnUrl } }));
      return;
    }

    this.buyForm.reset({ amount: l.price, paymentMethod: 'in_person' });
    this.showBuyForm.set(true);
  }

  /**
   * Envía el formulario de compra: el propio comprador reserva la venta a su nombre.
   *
   * `buyerId` va a `myId` igualmente: si quien llama a `reserve()` no es el vendedor, el
   * backend ya asume que el comprador es quien hace la petición e ignora este campo, pero el
   * DTO sigue exigiendo que venga informado.
   */
  onBuySubmit(): void {
    const l = this.listing();
    const myId = this.authService.currentUser()?.id;
    if (!l || !myId || this.buyForm.invalid) return;

    const { amount, paymentMethod } = this.buyForm.getRawValue();
    this.isProcessingTransaction.set(true);

    this.transactionService
      .reserve({ listingId: l.id, buyerId: myId, amount: amount!, paymentMethod: paymentMethod! })
      .subscribe({
        next: (transaction) => {
          this.isProcessingTransaction.set(false);
          this.showBuyForm.set(false);
          this.setTransaction(transaction);
          this.listing.update((current) => (current ? { ...current, status: 'reserved' } : current));
          this.snackBar.open('Reserva realizada. En espera de que el vendedor confirme la venta.', 'Cerrar', {
            duration: 4000
          });
        },
        error: (err) => {
          this.isProcessingTransaction.set(false);
          const message = err?.error?.message ?? 'No se pudo reservar la compra';
          this.snackBar.open(message, 'Cerrar', { duration: 4000 });
        }
      });
  }
}
