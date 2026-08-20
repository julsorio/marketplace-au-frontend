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
import { ListingResponse } from '../../../core/models/listing.model';

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
    MatProgressSpinnerModule
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
}