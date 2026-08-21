import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NominatimResult, GeocodeResult } from '../models/geocoding.model';

/**
 * Geocoding basado en OpenStreetMap (API pública de Nominatim).
 *
 * Nota para producción: el servicio público de Nominatim pide no superar 1 request/segundo
 * y usarlo solo para volúmenes bajos; para producción real conviene evaluar un Nominatim
 * autoalojado o un proveedor de pago (esto queda como mejora futura, igual que el resto
 * de puntos "pendiente para producción" del proyecto).
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.geocodingApiUrl;

  /** Busca coordenadas a partir de una dirección o suburbio en texto libre. */
  search(addressQuery: string): Observable<GeocodeResult[]> {
    const params = new HttpParams()
      .set('q', addressQuery)
      .set('format', 'json')
      .set('addressdetails', '1')
      .set('countrycodes', 'au')
      .set('limit', '5');

    return this.http
      .get<NominatimResult[]>(`${this.baseUrl}/search`, { params })
      .pipe(map((results) => results.map(this.toGeocodeResult)));
  }

  private toGeocodeResult(result: NominatimResult): GeocodeResult {
    const address = result.address ?? {};
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
      suburb: address.suburb ?? address.city ?? address.town ?? address.village ?? address.municipality,
      state: address.state
    };
  }
}
