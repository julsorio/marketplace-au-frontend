import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { FavoriteResponse } from '../models/favorite.model';

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/favorites`;

  // Set de ids de anuncios favoritos del usuario actual, en memoria, para poder pintar el
  // icono de corazón en cualquier pantalla (listing-list, listing-detail) sin pedir la lista
  // completa de favoritos (con el detalle de cada listing) cada vez.
  readonly favoriteIds = signal<Set<string>>(new Set());
  private loaded = false;

  /**
   * Carga en memoria (signal `favoriteIds`) los ids de los anuncios favoritos del usuario
   * actual, para poder pintar el icono de corazón en cualquier pantalla (listing-list,
   * listing-detail) sin pedir la lista completa de favoritos (con el detalle de cada
   * listing) cada vez. Se llama de forma reactiva (ver Navbar) cuando hay sesión iniciada;
   * es idempotente, así que da igual si se llama varias veces mientras dura la sesión.
   */
  ensureLoaded(): void {
    if (this.loaded || !this.authService.isAuthenticated()) {
      return;
    }
    this.loaded = true;

    this.getFavorites().subscribe({
      next: (favorites) => this.favoriteIds.set(new Set(favorites.map((f) => f.listing.id))),
      error: () => {
        this.loaded = false; // permite reintentar en la próxima navegación
      }
    });
  }

  /**
   * Obtiene la lista completa de favoritos del usuario, con el detalle de cada listing.
   * @returns Observable que emite el listado de favoritos.
   */
  getFavorites(): Observable<FavoriteResponse[]> {
    return this.http.get<FavoriteResponse[]>(this.apiUrl);
  }

  /**
   * Indica si un anuncio está marcado como favorito, consultando el signal en memoria
   * `favoriteIds` (sin llamar al backend).
   * @param listingId Id del anuncio.
   * @returns true si el anuncio está en favoritos.
   */
  isFavorite(listingId: string): boolean {
    return this.favoriteIds().has(listingId);
  }

  /**
   * Alterna el estado de favorito de un anuncio: lo añade si no lo estaba, o lo quita si ya
   * lo estaba.
   * @param listingId Id del anuncio.
   */
  toggle(listingId: string): void {
    if (this.isFavorite(listingId)) {
      this.remove(listingId);
    } else {
      this.add(listingId);
    }
  }

  /**
   * Añade un anuncio a favoritos con actualización optimista: el signal `favoriteIds` se
   * actualiza al instante para que la UI reaccione sin esperar al backend, y se revierte si
   * la petición falla.
   * @param listingId Id del anuncio a añadir.
   */
  add(listingId: string): void {
    // Actualización optimista: se refleja al instante en la UI y se revierte si falla.
    this.favoriteIds.update((ids) => new Set(ids).add(listingId));

    this.http.post<void>(`${this.apiUrl}/${listingId}`, {}).subscribe({
      error: () =>
        this.favoriteIds.update((ids) => {
          const next = new Set(ids);
          next.delete(listingId);
          return next;
        })
    });
  }

  /**
   * Quita un anuncio de favoritos con actualización optimista: el signal `favoriteIds` se
   * actualiza al instante para que la UI reaccione sin esperar al backend, y se revierte si
   * la petición falla.
   * @param listingId Id del anuncio a quitar.
   */
  remove(listingId: string): void {
    this.favoriteIds.update((ids) => {
      const next = new Set(ids);
      next.delete(listingId);
      return next;
    });

    this.http.delete<void>(`${this.apiUrl}/${listingId}`).subscribe({
      error: () => this.favoriteIds.update((ids) => new Set(ids).add(listingId))
    });
  }

  /**
   * Reinicia el estado de favoritos en memoria. Se llama al cerrar sesión (ver Navbar), para
   * que el siguiente usuario que inicie sesión en el mismo navegador no arrastre los
   * favoritos del anterior.
   */
  reset(): void {
    this.loaded = false;
    this.favoriteIds.set(new Set());
  }
}
