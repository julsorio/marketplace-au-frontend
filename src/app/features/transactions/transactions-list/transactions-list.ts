import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TransactionService } from '../../../core/services/transaction.service';
import { ListingService } from '../../../core/services/listing.service';
import { ReviewService } from '../../../core/services/review.service';
import { AuthService } from '../../../core/services/auth.service';
import { TransactionResponse } from '../../../core/models/transaction.model';

interface TransactionView {
  transaction: TransactionResponse;
  listingTitle: string;
  listingThumbnail: string | null;
  revieweeId: string;
  hasReviewed: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada'
};

/**
 * Listado de transacciones del usuario, organizado en pestañas de Compras y Ventas.
 *
 * Cada transacción confirmada incluye un botón "Dejar reseña" cuya disponibilidad se decide en
 * el cliente: no existe un endpoint "¿ya reseñé esto?", así que se deriva comprobando si ya hay
 * una reseña mía a la otra parte para ese anuncio (ver `enrich()`).
 */
@Component({
  selector: 'app-transactions-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatTabsModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './transactions-list.html',
  styleUrl: './transactions-list.scss'
})
export class TransactionsList implements OnInit {
  private readonly transactionService = inject(TransactionService);
  private readonly listingService = inject(ListingService);
  private readonly reviewService = inject(ReviewService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly purchases = signal<TransactionView[]>([]);
  readonly sales = signal<TransactionView[]>([]);
  readonly isLoadingPurchases = signal(true);
  readonly isLoadingSales = signal(true);

  // Id de la transacción cuyo formulario de reseña está abierto (uno solo a la vez, se
  // reutiliza el mismo FormGroup para todas las filas).
  readonly openReviewFor = signal<string | null>(null);
  readonly isSubmittingReview = signal(false);

  readonly reviewForm = this.fb.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['', Validators.maxLength(500)]
  });

  /**
   * Carga en paralelo las transacciones de la pestaña Compras (`getPurchases()`) y de la
   * pestaña Ventas (`getSales()`), enriqueciendo cada lista por separado.
   */
  ngOnInit(): void {
    this.transactionService.getPurchases().subscribe({
      next: (transactions) =>
        this.enrich(transactions).subscribe((views) => {
          this.purchases.set(views);
          this.isLoadingPurchases.set(false);
        }),
      error: () => this.isLoadingPurchases.set(false)
    });

    this.transactionService.getSales().subscribe({
      next: (transactions) =>
        this.enrich(transactions).subscribe((views) => {
          this.sales.set(views);
          this.isLoadingSales.set(false);
        }),
      error: () => this.isLoadingSales.set(false)
    });
  }

  /**
   * Completa cada transacción con el título/imagen del anuncio asociado (el endpoint de
   * transacciones solo trae `listingId`, mismo criterio que en `ConversationList` y
   * `FavoritesList`) y, para las confirmadas, con si ya existe una reseña mía a la otra parte
   * sobre ese anuncio.
   *
   * No hay endpoint "¿ya reseñé esto?": se deriva llamando a `GET /reviews/user/{revieweeId}`
   * y filtrando por `reviewerId` y `listingId`, siguiendo el mismo criterio de "reutilizar
   * endpoints existentes" ya usado para favoritos y transacciones.
   *
   * @param transactions Transacciones (compras o ventas) a enriquecer.
   * @returns Observable con las transacciones enriquecidas para la vista.
   */
  private enrich(transactions: TransactionResponse[]): Observable<TransactionView[]> {
    if (transactions.length === 0) {
      return of([]);
    }

    const myId = this.authService.currentUser()?.id;

    return forkJoin(
      transactions.map((t) => {
        const revieweeId = t.buyerId === myId ? t.sellerId : t.buyerId;

        const listing$ = this.listingService.getById(t.listingId).pipe(
          map((listing) => ({ listingTitle: listing.title, listingThumbnail: listing.images?.[0] ?? null })),
          catchError(() => of({ listingTitle: 'Anuncio no disponible', listingThumbnail: null as string | null }))
        );

        const hasReviewed$ =
          t.status === 'confirmed' && myId
            ? this.reviewService.getReviewsForUser(revieweeId).pipe(
                map((reviews) => reviews.some((r) => r.reviewerId === myId && r.listingId === t.listingId)),
                catchError(() => of(false))
              )
            : of(false);

        return forkJoin({ listing: listing$, hasReviewed: hasReviewed$ }).pipe(
          map(({ listing, hasReviewed }) => ({
            transaction: t,
            listingTitle: listing.listingTitle,
            listingThumbnail: listing.listingThumbnail,
            revieweeId,
            hasReviewed
          }))
        );
      })
    );
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
   * Traduce el estado interno de una transacción a su etiqueta legible en español.
   *
   * @param status Estado de la transacción tal como lo devuelve el backend.
   * @returns La etiqueta correspondiente, o el propio `status` si no hay traducción registrada.
   */
  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  /**
   * Abre el formulario de reseña para una transacción, reiniciándolo a sus valores por defecto.
   *
   * @param view Transacción sobre la que se va a dejar reseña.
   * @param event Evento de clic; se detiene su propagación para no interferir con otros
   * manejadores de la fila.
   */
  openReview(view: TransactionView, event: Event): void {
    event.stopPropagation();
    this.reviewForm.reset({ rating: 5, comment: '' });
    this.openReviewFor.set(view.transaction.id);
  }

  /**
   * Cierra el formulario de reseña sin enviarlo.
   *
   * @param event Evento de clic; se detiene su propagación para no interferir con otros
   * manejadores de la fila.
   */
  closeReview(event: Event): void {
    event.stopPropagation();
    this.openReviewFor.set(null);
  }

  /**
   * Envía la reseña del formulario abierto para una transacción.
   *
   * Si el backend responde 409 (ya existía una reseña, por ejemplo porque otra pestaña la
   * publicó antes), se da la reseña por hecha en vez de dejar el formulario abierto para
   * reintentar.
   *
   * @param view Transacción sobre la que se está dejando reseña.
   * @param event Evento de clic; se detiene su propagación para no interferir con otros
   * manejadores de la fila.
   */
  submitReview(view: TransactionView, event: Event): void {
    event.stopPropagation();
    if (this.reviewForm.invalid) return;

    const { rating, comment } = this.reviewForm.getRawValue();
    this.isSubmittingReview.set(true);

    this.reviewService
      .create({
        listingId: view.transaction.listingId,
        revieweeId: view.revieweeId,
        rating: rating!,
        comment: comment ?? ''
      })
      .subscribe({
        next: () => {
          this.isSubmittingReview.set(false);
          this.openReviewFor.set(null);
          this.markReviewed(view.transaction.id);
          this.snackBar.open('Reseña publicada', 'Cerrar', { duration: 3000 });
        },
        error: (err) => {
          this.isSubmittingReview.set(false);
          // 409 = ya existía una reseña (p.ej. otra pestaña la publicó antes): la damos por
          // hecha en vez de dejar el formulario abierto para reintentar.
          if (err?.status === 409) {
            this.openReviewFor.set(null);
            this.markReviewed(view.transaction.id);
          }
          const message = err?.error?.message ?? 'No se pudo publicar la reseña';
          this.snackBar.open(message, 'Cerrar', { duration: 4000 });
        }
      });
  }

  /**
   * Marca una transacción como ya reseñada en ambas listas (compras y ventas), actualizando el
   * estado local sin necesidad de recargar desde el backend.
   *
   * @param transactionId Id de la transacción recién reseñada.
   */
  private markReviewed(transactionId: string): void {
    const update = (views: TransactionView[]) =>
      views.map((v) => (v.transaction.id === transactionId ? { ...v, hasReviewed: true } : v));
    this.purchases.update(update);
    this.sales.update(update);
  }
}
