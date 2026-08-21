import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FavoriteService } from '../../../core/services/favorite.service';
import { FavoriteResponse } from '../../../core/models/favorite.model';

@Component({
  selector: 'app-favorites-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './favorites-list.html',
  styleUrl: './favorites-list.scss'
})
export class FavoritesList implements OnInit {
  private readonly favoriteService = inject(FavoriteService);

  readonly favorites = signal<FavoriteResponse[]>([]);
  readonly isLoading = signal(true);

  ngOnInit(): void {
    this.favoriteService.getFavorites().subscribe({
      next: (favorites) => {
        this.favorites.set(favorites);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  formatPrice(favorite: FavoriteResponse): string {
    const l = favorite.listing;
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: l.currency }).format(l.price);
  }

  // A diferencia del corazón en listing-list/listing-detail (que hace toggle), aquí siempre
  // significa "quitar de favoritos", así que llamamos directamente a remove() y sacamos la
  // tarjeta de la lista local al momento, sin esperar a un refetch.
  onRemove(listingId: string, event: Event): void {
    event.stopPropagation();
    this.favoriteService.remove(listingId);
    this.favorites.update((favs) => favs.filter((f) => f.listing.id !== listingId));
  }
}
