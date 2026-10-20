import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ListingService } from '../../../core/services/listing.service';
import { ListingResponse, LISTING_CONDITIONS } from '../../../core/models/listing.model';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoriteService } from '../../../core/services/favorite.service';
import {
  LocationFilter,
  LocationFilterDialog,
  LocationFilterDialogResult
} from './location-filter-dialog/location-filter-dialog';

@Component({
  selector: 'app-listing-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './listing-list.html',
  styleUrl: './listing-list.scss'
})
export class ListingList {
  private readonly listingService = inject(ListingService);
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  readonly favoriteService = inject(FavoriteService);

  readonly conditions = LISTING_CONDITIONS;

  readonly listings = signal<ListingResponse[]>([]);
  readonly isLoading = signal(true);
  // Ubicación + radio elegidos en el popup de ubicación (fuera del formulario de filtros,
  // porque no se escribe en un input sino que se elige en LocationFilterDialog).
  readonly locationFilter = signal<LocationFilter | null>(null);
  readonly locationDisplay = computed(() => {
    const location = this.locationFilter();
    return location ? `${location.label} · ${location.radiusKm} km` : '';
  });
  readonly hasResults = computed(() => this.listings().length > 0);
  readonly categories = this.categoryService.categories;

  readonly filterForm = this.fb.group({
    query: [''],
    category: [''],
    condition: [''],
    minPrice: [null as number | null],
    maxPrice: [null as number | null]
  });

  constructor() {
    this.categoryService.loadCategories();
    this.search();

    this.filterForm.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        takeUntilDestroyed()
      )
      .subscribe(() => this.search());
  }

  openLocationDialog(): void {
    this.dialog
      .open<LocationFilterDialog, LocationFilter | null, LocationFilterDialogResult>(LocationFilterDialog, {
        data: this.locationFilter(),
        width: '640px',
        maxWidth: '95vw',
        autoFocus: false
      })
      .afterClosed()
      .subscribe((result) => {
        if (result === undefined) {
          return;
        }
        this.locationFilter.set(result === 'clear' ? null : result);
        this.search();
      });
  }

  clearLocation(event: Event): void {
    // Evita que el click en la X abra también el popup (el campo entero abre el diálogo).
    event.stopPropagation();
    this.locationFilter.set(null);
    this.search();
  }

  private search(): void {
    this.isLoading.set(true);
    const filters = this.filterForm.value;
    const location = this.locationFilter();

    this.listingService.search({
      query: filters.query || undefined,
      category: filters.category || undefined,
      condition: filters.condition || undefined,
      minPrice: filters.minPrice ?? undefined,
      maxPrice: filters.maxPrice ?? undefined,
      latitude: location?.latitude,
      longitude: location?.longitude,
      radiusKm: location?.radiusKm
    }).subscribe({
      next: (results) => {
        this.listings.set(results);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  formatPrice(listing: ListingResponse): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: listing.currency }).format(listing.price);
  }

  // event.stopPropagation() evita que el click en el corazón también dispare la navegación
  // al detalle (la tarjeta entera tiene [routerLink]).
  toggleFavorite(listing: ListingResponse, event: Event): void {
    event.stopPropagation();

    if (!this.authService.isAuthenticated()) {
      const returnUrl = this.router.url;
      this.snackBar
        .open('Debes iniciar sesión para guardar favoritos', 'Iniciar sesión', { duration: 5000 })
        .onAction()
        .subscribe(() => this.router.navigate(['/login'], { queryParams: { returnUrl } }));
      return;
    }

    this.favoriteService.toggle(listing.id);
  }
}
