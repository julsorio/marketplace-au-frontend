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

  // Se llama de forma reactiva (ver Navbar) cuando hay sesión iniciada; es idempotente, así
  // que da igual si se llama varias veces mientras dura la sesión.
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

  getFavorites(): Observable<FavoriteResponse[]> {
    return this.http.get<FavoriteResponse[]>(this.apiUrl);
  }

  isFavorite(listingId: string): boolean {
    return this.favoriteIds().has(listingId);
  }

  toggle(listingId: string): void {
    if (this.isFavorite(listingId)) {
      this.remove(listingId);
    } else {
      this.add(listingId);
    }
  }

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

  // Se llama al cerrar sesión (ver Navbar), para que el siguiente usuario que inicie sesión
  // en el mismo navegador no arrastre los favoritos del anterior.
  reset(): void {
    this.loaded = false;
    this.favoriteIds.set(new Set());
  }
}
