import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { LocationPicker, LocationPicked } from '../../../../shared/components/location-picker/location-picker';

export interface LocationFilter {
  latitude: number;
  longitude: number;
  label: string;
  radiusKm: number;
}

// Resultado del diálogo: el filtro elegido, 'clear' si el usuario quita la ubicación,
// o undefined si cierra/cancela sin cambios.
export type LocationFilterDialogResult = LocationFilter | 'clear' | undefined;

export const MIN_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 100;

const MAP_POINT_LABEL = 'Punto en el mapa';

/**
 * Popup del filtro de ubicación del listado: el usuario busca su ubicación (o la marca en el
 * mapa) y ajusta con un slider el radio de búsqueda, que se dibuja como círculo en el mapa.
 */
@Component({
  selector: 'app-location-filter-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatSliderModule, LocationPicker],
  templateUrl: './location-filter-dialog.html',
  styleUrl: './location-filter-dialog.scss'
})
export class LocationFilterDialog {
  private readonly dialogRef = inject(MatDialogRef<LocationFilterDialog, LocationFilterDialogResult>);
  readonly data = inject<LocationFilter | null>(MAT_DIALOG_DATA);

  readonly minRadius = MIN_RADIUS_KM;
  readonly maxRadius = MAX_RADIUS_KM;

  readonly location = signal<Omit<LocationFilter, 'radiusKm'> | null>(
    this.data ? { latitude: this.data.latitude, longitude: this.data.longitude, label: this.data.label } : null
  );
  readonly radiusKm = signal(this.data?.radiusKm ?? MIN_RADIUS_KM);
  readonly canApply = computed(() => this.location() !== null);

  onLocationChange(picked: LocationPicked): void {
    const label = [picked.suburb, picked.state].filter(Boolean).join(', ') || MAP_POINT_LABEL;
    this.location.set({ latitude: picked.latitude, longitude: picked.longitude, label });
  }

  formatRadius(value: number): string {
    return `${value} km`;
  }

  apply(): void {
    const location = this.location();
    if (location) {
      this.dialogRef.close({ ...location, radiusKm: this.radiusKm() });
    }
  }

  clear(): void {
    this.dialogRef.close('clear');
  }
}
