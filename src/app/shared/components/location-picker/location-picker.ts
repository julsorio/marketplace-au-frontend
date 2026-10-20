import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  effect,
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
const RADIUS_COLOR = '#1a73e8';

/**
 * Selector de ubicación reutilizable: buscador de direcciones (geocoding con OSM/Nominatim
 * vía GeocodingService) + mapa Leaflet con un pin que se puede arrastrar o colocar con un clic
 * para ajustar la posición exacta.
 *
 * Si se le pasa `radiusKm`, además dibuja un círculo con ese radio alrededor del pin (lo usa
 * el filtro de ubicación del listado para mostrar el área de búsqueda).
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
  readonly radiusKm = input<number | null>(null);
  readonly locationChange = output<LocationPicked>();

  @ViewChild('mapContainer', { static: true })
  private mapContainerRef!: ElementRef<HTMLDivElement>;

  readonly query = signal('');
  readonly searching = signal(false);
  readonly results = signal<GeocodeResult[]>([]);
  readonly selectedAddress = signal<string | null>(null);

  private map!: L.Map;
  private marker: L.Marker | null = null;
  private circle: L.Circle | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // Redibuja el círculo cuando cambia el radio (p. ej. al mover el slider). La primera
    // ejecución llega antes de que exista el mapa; ese caso lo cubre ngAfterViewInit.
    effect(() => {
      const radius = this.radiusKm();
      if (this.map) {
        this.updateCircle(radius);
        this.fitToCircle();
      }
    });
  }

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
      this.fitToCircle();
    }

    // Dentro de un diálogo el contenedor puede no tener su tamaño final al crear el mapa
    // (animación de apertura); sin invalidateSize Leaflet deja tiles grises.
    this.resizeObserver = new ResizeObserver(() => this.map.invalidateSize());
    this.resizeObserver.observe(this.mapContainerRef.nativeElement);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.selectedAddress.set(null);
      this.placeMarker(e.latlng.lat, e.latlng.lng, { emit: true });
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
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
    this.fitToCircle();
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
        this.circle?.setLatLng(pos);
        this.selectedAddress.set(null);
        this.locationChange.emit({ latitude: pos.lat, longitude: pos.lng });
      });
    }
    this.updateCircle(this.radiusKm());

    if (opts.emit) {
      this.locationChange.emit({
        latitude: lat,
        longitude: lng,
        suburb: opts.suburb,
        state: opts.state
      });
    }
  }

  private updateCircle(radiusKm: number | null): void {
    if (!this.marker || radiusKm == null) {
      this.circle?.remove();
      this.circle = null;
      return;
    }

    const center = this.marker.getLatLng();
    if (this.circle) {
      this.circle.setLatLng(center);
      this.circle.setRadius(radiusKm * 1000);
    } else {
      this.circle = L.circle(center, {
        radius: radiusKm * 1000,
        color: RADIUS_COLOR,
        fillColor: RADIUS_COLOR,
        fillOpacity: 0.12,
        weight: 1
      }).addTo(this.map);
    }
  }

  private fitToCircle(): void {
    if (this.circle) {
      this.map.fitBounds(this.circle.getBounds(), { padding: [16, 16] });
    }
  }
}
