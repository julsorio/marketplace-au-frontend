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
import { LISTING_CONDITIONS, LISTING_DELIVERY_METHODS, DELIVERY_METHOD_LABELS } from '../../../core/models/listing.model';
import { CategoryService } from '../../../core/services/category.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocationPicker, LocationPicked } from '../../../shared/components/location-picker/location-picker';

/**
 * Formulario de anuncio en modo crear/editar unificado: el mismo componente y el mismo
 * `FormGroup` sirven para dar de alta un anuncio nuevo (sin `:id` en la ruta) y para editar uno
 * existente (con `:id`); `isEditMode` decide qué endpoint se llama al enviar. Las imágenes se
 * gestionan como un `FormArray` de URLs (una fila de texto por imagen), no como carga de
 * ficheros.
 */
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
    MatProgressSpinnerModule,
    LocationPicker
  ],
  templateUrl: './listing-form.html',
  styleUrl: './listing-form.scss'
})
export class ListingForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingService = inject(ListingService);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);

  readonly conditions = LISTING_CONDITIONS;
  readonly deliveryMethods = LISTING_DELIVERY_METHODS;
  readonly deliveryMethodLabels = DELIVERY_METHOD_LABELS;
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly listingId = signal<string | null>(null);

  /** `true` cuando la ruta trae `:id`: el formulario edita un anuncio existente en vez de crear uno nuevo. */
  readonly isEditMode = computed(() => this.listingId() !== null);
  readonly categories = this.categoryService.categories;

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    price: [null as number | null, [Validators.required, Validators.min(0)]],
    negotiable: [false],
    category: ['', Validators.required],
    subcategory: [''],
    condition: ['', Validators.required],
    deliveryMethod: ['in_person', Validators.required],
    suburb: ['', Validators.required],
    state: ['', Validators.required],
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required],
    images: this.fb.array<string>([])
  });

  private readonly selectedCategoryId = toSignal(
    this.form.get('category')!.valueChanges, {initialValue: ''}
  )

  /** Subcategorías disponibles para la categoría actualmente seleccionada en el formulario. */
  readonly availableSubcategories = computed(() => {
    const categoryId = this.selectedCategoryId();
    return categoryId ? this.categoryService.getSubcategories(categoryId) : [];
  })

  /** Acceso tipado al `FormArray` de URLs de imágenes del anuncio. */
  get imagesArray(): FormArray {
    return this.form.get('images') as FormArray;
  }

  /**
   * Prepara el formulario según el modo: en modo edición (hay `:id` en la ruta), desactiva la
   * validación obligatoria de latitud/longitud (el anuncio ya tiene ubicación guardada y no se
   * vuelve a pedir en el mapa) y carga los datos existentes del anuncio.
   */
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.categoryService.loadCategories();
    
    if (id) {
      this.listingId.set(id);
      this.form.get('latitude')?.clearValidators();
      this.form.get('latitude')?.updateValueAndValidity();
      this.form.get('longitude')?.clearValidators();
      this.form.get('longitude')?.updateValueAndValidity();
      this.loadListing(id);
    }
  }

  /**
   * Carga un anuncio existente y vuelca sus datos en el formulario, incluyendo una fila del
   * `FormArray` de imágenes por cada URL ya guardada.
   *
   * @param id Id del anuncio a editar.
   */
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
          deliveryMethod: listing.deliveryMethod,
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

  /**
   * Añade una fila vacía al `FormArray` de imágenes.
   */
  addImageField(): void {
    this.imagesArray.push(this.fb.control(''));
  }

  /**
   * Elimina una fila del `FormArray` de imágenes.
   *
   * @param index Posición de la imagen a eliminar dentro del array.
   */
  removeImageField(index: number): void {
    this.imagesArray.removeAt(index);
  }

  /**
   * Vuelca en el formulario la ubicación elegida en el `<app-location-picker>`.
   *
   * Se dispara cuando el usuario busca una dirección, hace clic en el mapa o arrastra el pin.
   * Solo se autocompletan suburbio/estado si el usuario aún no los ha escrito, para no pisar lo
   * que haya introducido manualmente.
   *
   * @param location Coordenadas y, si están disponibles, suburbio/estado resueltos.
   */
  onLocationPicked(location: LocationPicked): void {
    this.form.patchValue({
      latitude: location.latitude,
      longitude: location.longitude
    });

    if (location.suburb && !this.form.get('suburb')?.value) {
      this.form.get('suburb')?.setValue(location.suburb);
    }
    if (location.state && !this.form.get('state')?.value) {
      this.form.get('state')?.setValue(location.state);
    }
  }

  /**
   * Valida y envía el formulario, creando un anuncio nuevo o actualizando el existente según
   * `isEditMode`. Las filas vacías del `FormArray` de imágenes se descartan antes de enviar.
   */
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
        deliveryMethod: value.deliveryMethod!,
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
        deliveryMethod: value.deliveryMethod!,
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
