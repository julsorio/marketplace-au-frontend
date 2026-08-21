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
import { ListingService } from '../../../core/services/listing.service';
import { ListingResponse, LISTING_CONDITIONS } from '../../../core/models/listing.model';
import { CategoryService } from '../../../core/services/category.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoriteService } from '../../../core/services/favorite.service';

interface ResolvedLocation {
  latitude: number;
  longitude: number;
  label: string;
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

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
  private readonly geocodingService = inject(GeocodingService);
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  readonly favoriteService = inject(FavoriteService);

  readonly conditions = LISTING_CONDITIONS;
  readonly radiusOptions = RADIUS_OPTIONS;

  readonly listings = signal<ListingResponse[]>([]);
  readonly isLoading = signal(true);
  readonly isGeocoding = signal(false);
  readonly resolvedLocation = signal<ResolvedLocation | null>(null);
  readonly hasResults = computed(() => this.listings().length > 0);
  readonly categories = this.categoryService.categories;

  // Guarda el último texto de ubicación ya geocodificado, para no repetir la llamada a
  // Nominatim si el resto de filtros cambia pero la ubicación buscada sigue siendo la misma.
  private lastGeocodedQuery = '';

  readonly filterForm = this.fb.group({
    query: [''],
    category: [''],
    condition: [''],
    minPrice: [null as number | null],
    maxPrice: [null as number | null],
    locationQuery: [''],
    radiusKm: [25 as number | null]
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

  private search(): void {
    const locationQuery = (this.filterForm.value.locationQuery ?? '').trim();

    if (!locationQuery) {
      this.resolvedLocation.set(null);
      this.lastGeocodedQuery = '';
      this.runSearch();
      return;
    }

    if (locationQuery === this.lastGeocodedQuery && this.resolvedLocation()) {
      this.runSearch();
      return;
    }

    this.isGeocoding.set(true);
    this.geocodingService.search(locationQuery).subscribe({
      next: (results) => {
        this.isGeocoding.set(false);
        this.lastGeocodedQuery = locationQuery;

        if (results.length === 0) {
          this.resolvedLocation.set(null);
          this.snackBar.open('No se encontró esa ubicación', 'Cerrar', { duration: 4000 });
          this.runSearch();
          return;
        }

        const top = results[0];
        this.resolvedLocation.set({
          latitude: top.latitude,
          longitude: top.longitude,
          label: top.displayName
        });
        this.runSearch();
      },
      error: () => {
        this.isGeocoding.set(false);
        this.snackBar.open('No se pudo buscar esa ubicación', 'Cerrar', { duration: 4000 });
        this.runSearch();
      }
    });
  }

  private runSearch(): void {
    this.isLoading.set(true);
    const filters = this.filterForm.value;
    const location = this.resolvedLocation();

    this.listingService.search({
      query: filters.query || undefined,
      category: filters.category || undefined,
      condition: filters.condition || undefined,
      minPrice: filters.minPrice ?? undefined,
      maxPrice: filters.maxPrice ?? undefined,
      latitude: location?.latitude,
      longitude: location?.longitude,
      radiusKm: location ? (filters.radiusKm ?? undefined) : undefined
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
