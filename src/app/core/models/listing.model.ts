/** Precio de un anuncio, con su moneda y si el vendedor acepta negociarlo. */
export interface Price {
  amount: number;
  currency: string;
  negotiable: boolean;
}

/**
 * Un anuncio tal como lo devuelve la API. `latitude`/`longitude` son la ubicación exacta
 * solo cuando quien consulta es el propio vendedor; para cualquier otro visitante (incluido
 * el anónimo) el backend las difumina con un desplazamiento aleatorio antes de responder.
 */
export interface ListingResponse {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  negotiable: boolean;
  category: string;
  subcategory: string;
  condition: string;
  images: string[];
  suburb: string;
  state: string;
  latitude: number;
  longitude: number;
  status: string;
  views: number;
  favoritesCount: number;
  createdAt: string;
  deliveryMethod: string; // 'shipping' | 'in_person' | 'both'
}

/** Datos para crear un anuncio nuevo. La ubicación aquí sí debe ser la real: el difuminado lo aplica el backend solo al devolver el anuncio a otros usuarios. */
export interface CreateListingRequest {
  title: string;
  description: string;
  price: number;
  negotiable: boolean;
  category: string;
  subcategory: string;
  condition: string;
  attributes: Record<string, unknown>;
  images: string[];
  latitude: number;
  longitude: number;
  suburb: string;
  state: string;
  deliveryMethod: string;
}

/** Datos para actualizar un anuncio existente. No incluye ubicación: esta no se puede editar tras la creación. */
export interface UpdateListingRequest {
  title: string;
  description: string;
  price: number;
  negotiable: boolean;
  category: string;
  subcategory: string;
  condition: string;
  attributes: Record<string, unknown>;
  images: string[];
  deliveryMethod: string;
}

/** Filtros de búsqueda de anuncios. Todos son opcionales: solo se envían al backend los que tengan valor. */
export interface ListingSearchParams {
  category?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  state?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  query?: string;
  page?: number;
  size?: number;
}

export const LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair'] as const;
export type ListingCondition = typeof LISTING_CONDITIONS[number];

// El vendedor especifica si hace envíos, prefiere venta en persona, o acepta ambas.
export const LISTING_DELIVERY_METHODS = ['shipping', 'in_person', 'both'] as const;
export type ListingDeliveryMethod = typeof LISTING_DELIVERY_METHODS[number];

/** Etiquetas en español para mostrar cada `ListingDeliveryMethod` en la interfaz. */
export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  shipping: 'Envío',
  in_person: 'Solo en persona',
  both: 'Envío o en persona'
};