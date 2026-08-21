import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ListingService } from '../../../core/services/listing.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoriteService } from '../../../core/services/favorite.service';
import { ListingResponse } from '../../../core/models/listing.model';
import { LocationMapView } from '../../../shared/components/location-map-view/location-map-view';

@Component({
  selector: 'app-listing-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
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
  readonly favoriteService = inject(FavoriteService);

  readonly listing = signal<ListingResponse | null>(null);
  readonly isLoading = signal(true);
  readonly notFound = signal(false);
  readonly selectedImageIndex = signal(0);

  readonly isOwner = computed(() => {
    const currentUser = this.authService.currentUser();
    const currentListing = this.listing();
    return !!currentUser && !!currentListing && currentUser.id === currentListing.sellerId;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      this.isLoading.set(false);
      return;
    }

    this.listingService.getById(id).subscribe({
      next: (result) => {
        this.listing.set(result);
        this.isLoading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      }
    });
  }

  formatPrice(): string {
    const l = this.listing();
    if (!l) return '';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: l.currency }).format(l.price);
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
}
