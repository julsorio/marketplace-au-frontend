import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ListingService } from '../../../core/services/listing.service';
import { LISTING_CONDITIONS } from '../../../core/models/listing.model';

@Component({
  selector: 'app-listing-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './listing-form.html',
  styleUrl: './listing-form.scss'
})
export class ListingForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  private readonly snackBar = inject(MatSnackBar);

  readonly conditions = LISTING_CONDITIONS;
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly listingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.listingId() !== null);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    price: [null as number | null, [Validators.required, Validators.min(0)]],
    negotiable: [false],
    category: ['', Validators.required],
    subcategory: [''],
    condition: ['', Validators.required],
    suburb: ['', Validators.required],
    state: ['', Validators.required],
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required],
    images: this.fb.array<string>([])
  });

  get imagesArray(): FormArray {
    return this.form.get('images') as FormArray;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.listingId.set(id);
      this.form.get('latitude')?.clearValidators();
      this.form.get('latitude')?.updateValueAndValidity();
      this.form.get('longitude')?.clearValidators();
      this.form.get('longitude')?.updateValueAndValidity();
      this.loadListing(id);
    }
  }

  private loadListing(id: string): void {
    this.isLoading.set(true);
    this.listingService.getById(id).subscribe({
      next: (listing) => {
        this.form.patchValue({
          title: listing.title,
          description: listing.description,
          price: listing.price,
          negotiable: listing.negotiable,
          category: listing.category,
          subcategory: listing.subcategory,
          condition: listing.condition,
          suburb: listing.suburb,
          state: listing.state
        });
        listing.images.forEach(img => this.imagesArray.push(this.fb.control(img)));
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('No se pudo cargar el anuncio', 'Cerrar', { duration: 4000 });
        this.isLoading.set(false);
      }
    });
  }

  addImageField(): void {
    this.imagesArray.push(this.fb.control(''));
  }

  removeImageField(index: number): void {
    this.imagesArray.removeAt(index);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const value = this.form.value;
    const images = (value.images ?? []).filter((img): img is string => !!img && img.trim() !== '');

    if (this.isEditMode()) {
      this.listingService.update(this.listingId()!, {
        title: value.title!,
        description: value.description!,
        price: value.price!,
        negotiable: value.negotiable!,
        category: value.category!,
        subcategory: value.subcategory!,
        condition: value.condition!,
        attributes: {},
        images
      }).subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.snackBar.open('Anuncio actualizado', 'Cerrar', { duration: 3000 });
          this.router.navigate(['/listings', result.id]);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.snackBar.open('Error al actualizar el anuncio', 'Cerrar', { duration: 4000 });
        }
      });
    } else {
      this.listingService.create({
        title: value.title!,
        description: value.description!,
        price: value.price!,
        negotiable: value.negotiable!,
        category: value.category!,
        subcategory: value.subcategory!,
        condition: value.condition!,
        attributes: {},
        images,
        latitude: value.latitude!,
        longitude: value.longitude!,
        suburb: value.suburb!,
        state: value.state!
      }).subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.snackBar.open('Anuncio creado', 'Cerrar', { duration: 3000 });
          this.router.navigate(['/listings', result.id]);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          const message = err.error?.message ?? 'Error al crear el anuncio';
          this.snackBar.open(message, 'Cerrar', { duration: 4000 });
        }
      });
    }
  }
}