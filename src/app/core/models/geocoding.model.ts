// Respuesta cruda de la API de búsqueda de Nominatim (geocoding de OpenStreetMap)
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

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

// Forma normalizada que usamos dentro de la app (ya no exponemos los campos de Nominatim tal cual)
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  suburb?: string;
  state?: string;
}
