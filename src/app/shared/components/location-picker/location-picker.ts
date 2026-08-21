import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  inject,
  signal,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as L from 'leaflet';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { GeocodeResult } from '../../../core/models/geocoding.model';

// Arreglo del icono por defecto de Leaflet: al empaquetar con Angular, las rutas relativas
// que Leaflet usa internamente para las imágenes del marcador se rompen. Las servimos desde
// /assets/leaflet, copiadas ahí en angular.json a partir de node_modules/leaflet/dist/images.
const defaultIcon = L.icon({
  iconUrl: 'assets/leaflet/marker-icon.png',
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = defaultIcon;

export interface LocationPicked {
  latitude: number;
  longitude: number;
  suburb?: string;
  state?: string;
}

const AUSTRALIA_CENTER: L.LatLngTuple = [-25.2744, 133.7751];

/**
 * Selector de ubicación reutilizable: buscador de direcciones (geocoding con OSM/Nominatim
 * vía GeocodingService) + mapa Leaflet con un pin que se puede arrastrar o colocar con un clic
 * para ajustar la posición exacta.
 */
@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.scss'
})
export class LocationPicker implements AfterViewInit, OnDestroy {
  private readonly geocodingService = inject(GeocodingService);

  readonly initialLatitude = input<number | null>(null);
  readonly initialLongitude = input<number | null>(null);
  readonly locationChange = output<LocationPicked>();

  @ViewChild('mapContainer', { static: true })
  private mapContainerRef!: ElementRef<HTMLDivElement>;

  readonly query = signal('');
  readonly searching = signal(false);
  readonly results = signal<GeocodeResult[]>([]);
  readonly selectedAddress = signal<string | null>(null);

  private map!: L.Map;
  private marker: L.Marker | null = null;

  ngAfterViewInit(): void {
    const lat = this.initialLatitude();
    const lng = this.initialLongitude();
    const hasInitial = lat != null && lng != null;

    this.map = L.map(this.mapContainerRef.nativeElement).setView(
      hasInitial ? [lat!, lng!] : AUSTRALIA_CENTER,
      hasInitial ? 14 : 4
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    if (hasInitial) {
      this.placeMarker(lat!, lng!, { emit: false });
    }

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.selectedAddress.set(null);
      this.placeMarker(e.latlng.lat, e.latlng.lng, { emit: true });
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  search(): void {
    const q = this.query().trim();
    if (!q) {
      return;
    }

    this.searching.set(true);
    this.geocodingService.search(q).subscribe({
      next: (results) => {
        this.results.set(results);
        this.searching.set(false);
      },
      error: () => {
        this.results.set([]);
        this.searching.set(false);
      }
    });
  }

  selectResult(result: GeocodeResult): void {
    this.map.setView([result.latitude, result.longitude], 15);
    this.placeMarker(result.latitude, result.longitude, {
      emit: true,
      suburb: result.suburb,
      state: result.state
    });
    this.selectedAddress.set(result.displayName);
    this.results.set([]);
    this.query.set('');
  }

  private placeMarker(
    lat: number,
    lng: number,
    opts: { emit: boolean; suburb?: string; state?: string }
  ): void {
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLatLng();
        this.selectedAddress.set(null);
        this.locationChange.emit({ latitude: pos.lat, longitude: pos.lng });
      });
    }

    if (opts.emit) {
      this.locationChange.emit({
        latitude: lat,
        longitude: lng,
        suburb: opts.suburb,
        state: opts.state
      });
    }
  }
}
