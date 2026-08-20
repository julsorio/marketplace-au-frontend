import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ListingService } from '../../../core/services/listing.service';
import { ListingResponse, LISTING_CONDITIONS } from '../../../core/models/listing.model';

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

  readonly conditions = LISTING_CONDITIONS;

  readonly listings = signal<ListingResponse[]>([]);
  readonly isLoading = signal(true);
  readonly hasResults = computed(() => this.listings().length > 0);

  readonly filterForm = this.fb.group({
    query: [''],
    category: [''],
    condition: [''],
    minPrice: [null as number | null],
    maxPrice: [null as number | null]
  });

  constructor() {
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
    this.isLoading.set(true);
    const filters = this.filterForm.value;

    this.listingService.search({
      query: filters.query || undefined,
      category: filters.category || undefined,
      condition: filters.condition || undefined,
      minPrice: filters.minPrice ?? undefined,
      maxPrice: filters.maxPrice ?? undefined
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
}