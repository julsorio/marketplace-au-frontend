import { Component, ElementRef, AfterViewInit, OnDestroy, ViewChild, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import * as L from 'leaflet';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Mapa de solo lectura para el detalle de un anuncio. A diferencia de LocationPicker,
 * este componente no permite buscar ni arrastrar nada: por privacidad del vendedor no
 * mostramos el pin exacto, solo un círculo centrado en la ubicación con un radio aproximado.
 *
 * Nota: esto es solo una aproximación visual — las coordenadas exactas siguen viajando tal
 * cual en la respuesta de la API. Difuminar la ubicación también en el backend (por ejemplo,
 * redondeando o añadiendo ruido a las coordenadas antes de exponerlas a quien no es el dueño
 * del anuncio) queda pendiente como mejora de privacidad real antes de producción.
 */
@Component({
  selector: 'app-location-map-view',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './location-map-view.html',
  styleUrl: './location-map-view.scss'
})
export class LocationMapView implements AfterViewInit, OnDestroy {
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  readonly radiusMeters = input<number>(800);

  @ViewChild('mapContainer', { static: true })
  private mapContainerRef!: ElementRef<HTMLDivElement>;

  private map!: L.Map;

  ngAfterViewInit(): void {
    const center: L.LatLngTuple = [this.latitude(), this.longitude()];

    this.map = L.map(this.mapContainerRef.nativeElement, {
      scrollWheelZoom: false
    }).setView(center, 13);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19
    }).addTo(this.map);

    const circle = L.circle(center, {
      radius: this.radiusMeters(),
      color: '#1a73e8',
      fillColor: '#1a73e8',
      fillOpacity: 0.15,
      weight: 1
    }).addTo(this.map);

    this.map.fitBounds(circle.getBounds(), { maxZoom: 15 });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
