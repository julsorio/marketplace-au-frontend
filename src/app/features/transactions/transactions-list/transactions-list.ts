import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TransactionService } from '../../../core/services/transaction.service';
import { ListingService } from '../../../core/services/listing.service';
import { TransactionResponse } from '../../../core/models/transaction.model';

interface TransactionView {
  transaction: TransactionResponse;
  listingTitle: string;
  listingThumbnail: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada'
};

@Component({
  selector: 'app-transactions-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTabsModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './transactions-list.html',
  styleUrl: './transactions-list.scss'
})
export class TransactionsList implements OnInit {
  private readonly transactionService = inject(TransactionService);
  private readonly listingService = inject(ListingService);

  readonly purchases = signal<TransactionView[]>([]);
  readonly sales = signal<TransactionView[]>([]);
  readonly isLoadingPurchases = signal(true);
  readonly isLoadingSales = signal(true);

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

  // El endpoint de transacciones solo trae listingId; lo completamos con título/imagen del
  // anuncio, mismo criterio que en ConversationList y FavoritesList.
  private enrich(transactions: TransactionResponse[]): Observable<TransactionView[]> {
    if (transactions.length === 0) {
      return of([]);
    }

    return forkJoin(
      transactions.map((t) =>
        this.listingService.getById(t.listingId).pipe(
          map((listing) => ({
            transaction: t,
            listingTitle: listing.title,
            listingThumbnail: listing.images?.[0] ?? null
          })),
          catchError(() => of({ transaction: t, listingTitle: 'Anuncio no disponible', listingThumbnail: null }))
        )
      )
    );
  }

  formatAmount(t: TransactionResponse): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: t.currency }).format(t.amount);
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }
}
