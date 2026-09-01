/**
 * Desglose de dirección tal como lo devuelve Nominatim (geocoding de OpenStreetMap).
 * Todos los campos son opcionales porque Nominatim solo incluye los niveles que
 * consigue resolver para cada resultado; por eso `city`, `town`, `village` y
 * `municipality` son alternativas entre sí según el tipo de lugar, no campos que
 * vengan siempre todos juntos.
 */
export interface NominatimAddress {
  road?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

/** Respuesta cruda de la API de búsqueda de Nominatim, un resultado por lugar encontrado. */
export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

/**
 * Forma normalizada que usa la app para un resultado de geocoding, ya adaptada desde
 * `NominatimResult` (la app no expone los campos de Nominatim tal cual fuera de
 * `GeocodingService`).
 */
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  suburb?: string;
  state?: string;
}
