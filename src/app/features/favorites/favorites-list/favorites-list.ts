import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FavoriteService } from '../../../core/services/favorite.service';
import { FavoriteResponse } from '../../../core/models/favorite.model';

/**
 * Pantalla que lista los anuncios marcados como favoritos por el usuario autenticado.
 *
 * Ruta protegida por `authGuard`: solo es alcanzable con sesión iniciada.
 */
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

  /**
   * Carga la lista de favoritos del usuario al iniciar la pantalla.
   */
  ngOnInit(): void {
    this.favoriteService.getFavorites().subscribe({
      next: (favorites) => {
        this.favorites.set(favorites);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  /**
   * Formatea el precio del anuncio asociado a un favorito como moneda localizada (en-AU).
   *
   * @param favorite Favorito cuyo anuncio se quiere formatear.
   * @returns El precio formateado como cadena de moneda.
   */
  formatPrice(favorite: FavoriteResponse): string {
    const l = favorite.listing;
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: l.currency }).format(l.price);
  }

  /**
   * Quita un anuncio de la lista de favoritos.
   *
   * A diferencia del corazón en listing-list/listing-detail (que hace toggle), aquí siempre
   * significa "quitar de favoritos", así que se llama directamente a `remove()` y se saca la
   * tarjeta de la lista local al momento, sin esperar a un refetch.
   *
   * @param listingId Id del anuncio a quitar de favoritos.
   * @param event Evento de clic; se detiene su propagación para no disparar otros manejadores
   * (p. ej. la navegación al detalle si la tarjeta entera es clicable).
   */
  onRemove(listingId: string, event: Event): void {
    event.stopPropagation();
    this.favoriteService.remove(listingId);
    this.favorites.update((favs) => favs.filter((f) => f.listing.id !== listingId));
  }
}
