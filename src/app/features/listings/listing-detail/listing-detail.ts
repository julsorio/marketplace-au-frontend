import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, Observable } from 'rxjs';
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
import { MatDialog } from '@angular/material/dialog';
import { ListingService } from '../../../core/services/listing.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoriteService } from '../../../core/services/favorite.service';
import { ConversationService } from '../../../core/services/conversation.service';
import { UserService } from '../../../core/services/user.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { PaymentService } from '../../../core/services/payment.service';
import { ListingResponse, DELIVERY_METHOD_LABELS } from '../../../core/models/listing.model';
import { DeliveryType, PaymentMethod, TransactionResponse } from '../../../core/models/transaction.model';
import { UserPublicProfile } from '../../../core/models/user.model';
import { LocationMapView } from '../../../shared/components/location-map-view/location-map-view';
import {
  CardPaymentDialog,
  CardPaymentDialogData,
  CardPaymentDialogResult
} from '../../../shared/components/card-payment-dialog/card-payment-dialog';

const STATUS_LABELS: Record<string, string> = {
  active: 'Disponible',
  reserved: 'Reservado',
  sold: 'Vendido',
  expired: 'Expirado',
  draft: 'Borrador'
};

const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  shipping: 'Envío',
  in_person: 'Entrega en persona'
};

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
  private readonly dialog = inject(MatDialog);
  private readonly conversationService = inject(ConversationService);
  private readonly userService = inject(UserService);
  private readonly transactionService = inject(TransactionService);
  private readonly paymentService = inject(PaymentService);
  private readonly fb = inject(FormBuilder);
  readonly favoriteService = inject(FavoriteService);

  readonly deliveryTypeLabels = DELIVERY_TYPE_LABELS;

  readonly listing = signal<ListingResponse | null>(null);
  readonly isLoading = signal(true);
  readonly notFound = signal(false);
  readonly selectedImageIndex = signal(0);
  readonly sellerProfile = signal<UserPublicProfile | null>(null);

  // Transacción (reserva/venta) relacionada con este anuncio y con el usuario actual: si es
  // el vendedor, la suya como vendedor; si es el comprador, la suya como comprador. No hay
  // endpoint para "la transacción de este listing", así que se deriva filtrando
  // getSales()/getPurchases() por listingId — igual criterio que usamos para favoritos.
  readonly myTransaction = signal<TransactionResponse | null>(null);
  readonly buyerName = signal<string>('');
  readonly candidateBuyers = signal<{ id: string; name: string }[]>([]);
  readonly showReserveForm = signal(false);
  readonly isProcessingTransaction = signal(false);

  // Reserva hecha por el vendedor para un comprador con el que ya negoció: solo en efectivo y en
  // persona. Con tarjeta siempre inicia la compra el comprador (él es quien paga).
  readonly reserveForm = this.fb.group({
    buyerId: ['', Validators.required]
  });

  // Formulario de compra, para cuando es el propio comprador quien hace clic en "Comprar". Sin
  // importe: se paga siempre el precio del anuncio.
  readonly showBuyForm = signal(false);
  readonly buyForm = this.fb.group({
    deliveryType: ['in_person' as DeliveryType, Validators.required],
    paymentMethod: ['in_person' as PaymentMethod, Validators.required]
  });
  // Espejo del formulario en signals para que la plantilla reaccione sin zone.js.
  private readonly buyFormValue = signal(this.buyForm.getRawValue());

  readonly trackingNumber = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(64)]
  });

  readonly isOwner = computed(() => {
    const currentUser = this.authService.currentUser();
    const currentListing = this.listing();
    return !!currentUser && !!currentListing && currentUser.id === currentListing.sellerId;
  });

  readonly statusLabel = computed(() => {
    const l = this.listing();
    return l ? (STATUS_LABELS[l.status] ?? l.status) : '';
  });

  readonly deliveryMethodLabel = computed(() => {
    const l = this.listing();
    return l ? (DELIVERY_METHOD_LABELS[l.deliveryMethod] ?? l.deliveryMethod) : '';
  });

  // Tipos de entrega que admite el anuncio.
  readonly deliveryOptions = computed<DeliveryType[]>(() => {
    const method = this.listing()?.deliveryMethod;
    if (method === 'shipping') return ['shipping'];
    if (method === 'both') return ['in_person', 'shipping'];
    return ['in_person'];
  });

  // Tarjeta disponible: el vendedor completó el alta en Stripe y la app tiene clave publicable.
  readonly cardAvailable = computed(
    () => !!this.sellerProfile()?.acceptsCardPayments && this.paymentService.isCardPaymentConfigured
  );

  // El efectivo exige verse en persona; con envío solo se puede pagar con tarjeta.
  readonly cashAllowed = computed(() => this.buyFormValue().deliveryType === 'in_person');

  readonly buyFormPaysByCard = computed(() => this.buyFormValue().paymentMethod === 'card');

  readonly canSubmitBuy = computed(() => {
    const { paymentMethod } = this.buyFormValue();
    return paymentMethod === 'card' ? this.cardAvailable() : this.cashAllowed();
  });

  constructor() {
    this.buyForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.buyFormValue.set(this.buyForm.getRawValue());
    });

    // Con envío no hay efectivo: se cambia a tarjeta automáticamente.
    this.buyForm.controls.deliveryType.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      if (type === 'shipping') {
        this.buyForm.controls.paymentMethod.setValue('card');
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    // Vuelta desde Stripe tras un pago que necesitó redirección (p. ej. algunos 3D Secure).
    if (this.route.snapshot.queryParamMap.get('payment') === 'return') {
      this.snackBar.open('Estamos confirmando tu pago. Puede tardar unos segundos.', 'Cerrar', { duration: 5000 });
    }

    this.listingService.getById(id, true).subscribe({
      next: (result) => {
        this.listing.set(result);
        this.isLoading.set(false);
        this.loadSellerProfile(result.sellerId);

        // Solo tiene sentido buscar una transacción si el anuncio no está disponible (ya
        // fue reservado o vendido) y hay alguien identificado consultándolo.
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

  // Nombre y rating del vendedor, para que un comprador pueda hacerse una idea de su
  // reputación antes de contactar o comprar. Se muestra con enlace a /users/:id.
  private loadSellerProfile(sellerId: string): void {
    this.userService.getPublicProfile(sellerId).subscribe({
      next: (profile) => this.sellerProfile.set(profile),
      error: () => this.sellerProfile.set(null)
    });
  }

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

  private setTransaction(t: TransactionResponse | null): void {
    this.myTransaction.set(t);

    if (t && this.isOwner()) {
      this.userService.getPublicProfile(t.buyerId).subscribe({
        next: (u) => this.buyerName.set(u.displayName),
        error: () => this.buyerName.set('Comprador')
      });
    }
  }

  private reloadTransaction(): void {
    const l = this.listing();
    if (l) this.loadTransactionInfo(l);
  }

  formatPrice(): string {
    const l = this.listing();
    if (!l) return '';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: l.currency }).format(l.price);
  }

  formatDateTime(iso: string | null): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

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

    // No hay conversación todavía: se crea en el backend con el primer mensaje.
    // ConversationThread lee listingId/recipientId de los query params en ese caso.
    this.router.navigate(['/conversations/new'], {
      queryParams: { listingId: l.id, recipientId: l.sellerId }
    });
  }

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

  formatAmount(t: TransactionResponse, value: number = t.amount): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: t.currency }).format(value);
  }

  // Lo que recibe el vendedor en una venta con tarjeta, tras la comisión.
  netAmount(t: TransactionResponse): string {
    return this.formatAmount(t, t.amount - t.platformFee);
  }

  openReserveForm(): void {
    const l = this.listing();
    if (!l) return;

    this.reserveForm.reset({ buyerId: '' });
    this.showReserveForm.set(true);
    this.loadCandidateBuyers(l.id);
  }

  // Candidatos a comprador: gente con la que el vendedor ya ha hablado sobre este anuncio
  // (no hay en la app ninguna otra forma de saber el id de un posible comprador). Si no hay
  // conversaciones todavía, el campo de texto libre del formulario sigue disponible.
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

  onSelectCandidateBuyer(id: string): void {
    this.reserveForm.controls.buyerId.setValue(id);
  }

  onReserveSubmit(): void {
    const l = this.listing();
    if (!l || this.reserveForm.invalid) return;

    const { buyerId } = this.reserveForm.getRawValue();
    this.isProcessingTransaction.set(true);

    this.transactionService
      .reserve({ listingId: l.id, buyerId: buyerId!, paymentMethod: 'in_person', deliveryType: 'in_person' })
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

  onConfirmSale(): void {
    this.runAction(
      (t) => this.transactionService.confirm(t.id),
      'Venta confirmada',
      'No se pudo confirmar la venta',
      'sold'
    );
  }

  onCancelTransaction(): void {
    const t = this.myTransaction();
    if (!t) return;

    const paid = t.paymentMethod === 'card' && t.status !== 'awaiting_payment';
    const question = paid
      ? '¿Seguro que quieres cancelar esta venta? Se devolverá el importe íntegro al comprador.'
      : '¿Seguro que quieres cancelar esta reserva?';
    if (!confirm(question)) return;

    this.isProcessingTransaction.set(true);
    this.transactionService.cancel(t.id).subscribe({
      next: () => {
        this.isProcessingTransaction.set(false);
        this.setTransaction(null);
        this.listing.update((current) => (current ? { ...current, status: 'active' } : current));
        this.snackBar.open(paid ? 'Venta cancelada y reembolsada' : 'Reserva cancelada', 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        this.isProcessingTransaction.set(false);
        const message = err?.error?.message ?? 'No se pudo cancelar la reserva';
        this.snackBar.open(message, 'Cerrar', { duration: 4000 });
      }
    });
  }

  onAcceptPurchase(): void {
    this.runAction((t) => this.transactionService.accept(t.id), 'Compra aceptada', 'No se pudo aceptar la compra');
  }

  onShip(): void {
    if (this.trackingNumber.invalid) return;
    const tracking = this.trackingNumber.value.trim();
    this.runAction(
      (t) => this.transactionService.ship(t.id, tracking),
      'Envío registrado',
      'No se pudo registrar el envío'
    );
  }

  onConfirmReceipt(): void {
    if (!confirm('¿Confirmas que has recibido el artículo? Se liberará el pago al vendedor.')) return;
    this.runAction(
      (t) => this.transactionService.confirmReceipt(t.id),
      'Compra completada',
      'No se pudo confirmar la recepción',
      'sold'
    );
  }

  private runAction(
    call: (t: TransactionResponse) => Observable<TransactionResponse>,
    successMessage: string,
    errorMessage: string,
    listingStatus?: string
  ): void {
    const t = this.myTransaction();
    if (!t) return;

    this.isProcessingTransaction.set(true);
    call(t).subscribe({
      next: (updated) => {
        this.isProcessingTransaction.set(false);
        this.setTransaction(updated);
        if (listingStatus) {
          this.listing.update((current) => (current ? { ...current, status: listingStatus } : current));
        }
        this.snackBar.open(successMessage, 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        this.isProcessingTransaction.set(false);
        this.snackBar.open(err?.error?.message ?? errorMessage, 'Cerrar', { duration: 4000 });
      }
    });
  }

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

    const deliveryType = this.deliveryOptions()[0];
    const paymentMethod: PaymentMethod = deliveryType === 'shipping' || this.cardAvailable() ? 'card' : 'in_person';
    this.buyForm.reset({ deliveryType, paymentMethod });
    this.showBuyForm.set(true);
  }

  onBuySubmit(): void {
    const l = this.listing();
    const myId = this.authService.currentUser()?.id;
    if (!l || !myId || this.buyForm.invalid || !this.canSubmitBuy()) return;

    const { deliveryType, paymentMethod } = this.buyForm.getRawValue();
    this.isProcessingTransaction.set(true);

    // buyerId va a myId igualmente: si quien llama a reserve() no es el vendedor, el backend
    // ya asume que el comprador es quien hace la petición e ignora este campo.
    this.transactionService
      .reserve({ listingId: l.id, buyerId: myId, paymentMethod: paymentMethod!, deliveryType: deliveryType! })
      .subscribe({
        next: (transaction) => {
          this.isProcessingTransaction.set(false);
          this.showBuyForm.set(false);
          this.setTransaction(transaction);
          this.listing.update((current) => (current ? { ...current, status: 'reserved' } : current));

          if (transaction.paymentMethod === 'card') {
            this.openPaymentDialog(transaction);
          } else {
            this.snackBar.open('Reserva realizada. En espera de que el vendedor confirme la venta.', 'Cerrar', {
              duration: 4000
            });
          }
        },
        error: (err) => {
          this.isProcessingTransaction.set(false);
          const message = err?.error?.message ?? 'No se pudo reservar la compra';
          this.snackBar.open(message, 'Cerrar', { duration: 4000 });
        }
      });
  }

  openPaymentDialog(t: TransactionResponse | null = this.myTransaction()): void {
    if (!t) return;

    this.dialog
      .open<CardPaymentDialog, CardPaymentDialogData, CardPaymentDialogResult>(CardPaymentDialog, {
        data: { transactionId: t.id, listingId: t.listingId, amount: t.amount, currency: t.currency },
        width: '520px',
        maxWidth: '95vw',
        autoFocus: false
      })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'paid') {
          this.snackBar.open('Pago realizado. El vendedor tiene 24 h para aceptar la compra.', 'Cerrar', {
            duration: 5000
          });
        } else if (result === 'processing') {
          this.snackBar.open('Estamos confirmando tu pago. Puede tardar unos segundos.', 'Cerrar', { duration: 5000 });
        } else {
          this.snackBar.open('Reserva pendiente de pago. Puedes pagar desde este anuncio antes de que caduque.', 'Cerrar', {
            duration: 5000
          });
        }
        this.reloadTransaction();
      });
  }
}
