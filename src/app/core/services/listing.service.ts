import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ListingResponse,
  CreateListingRequest,
  UpdateListingRequest,
  ListingSearchParams
} from '../models/listing.model';

@Injectable({ providedIn: 'root' })
export class ListingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/listings`;

  /**
   * Busca anuncios aplicando los filtros indicados; solo se envían al backend los filtros
   * que tengan valor (se omiten los `undefined`, `null` o cadena vacía).
   * @param params Filtros de búsqueda (categoría, precio, ubicación, texto, etc.).
   * @returns Observable que emite el listado de anuncios que cumplen los filtros.
   */
  search(params: ListingSearchParams): Observable<ListingResponse[]> {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http.get<ListingResponse[]>(this.apiUrl, { params: httpParams });
  }

  /**
   * Obtiene un anuncio por id.
   * @param id Id del anuncio.
   * @param trackView Si es true, la petición cuenta como una visualización real del anuncio
   * en el backend. El valor por defecto es false: solo la pantalla de detalle del anuncio
   * debe pasar true (una visita real del usuario); el resto de pantallas llama a este mismo
   * método solo para enriquecer sus listas con título/imagen del listing (conversaciones,
   * transacciones), y eso no debe contar como una visualización.
   * @returns Observable que emite el anuncio solicitado.
   */
  getById(id: string, trackView = false): Observable<ListingResponse> {
    const params = trackView ? new HttpParams().set('trackView', 'true') : undefined;
    return this.http.get<ListingResponse>(`${this.apiUrl}/${id}`, { params });
  }

  /**
   * Crea un nuevo anuncio.
   * @param request Datos del anuncio a crear.
   * @returns Observable que emite el anuncio creado.
   */
  create(request: CreateListingRequest): Observable<ListingResponse> {
    return this.http.post<ListingResponse>(this.apiUrl, request);
  }

  /**
   * Actualiza los datos de un anuncio existente.
   * @param id Id del anuncio a actualizar.
   * @param request Datos a actualizar del anuncio.
   * @returns Observable que emite el anuncio actualizado.
   */
  update(id: string, request: UpdateListingRequest): Observable<ListingResponse> {
    return this.http.put<ListingResponse>(`${this.apiUrl}/${id}`, request);
  }

  /**
   * Cambia el estado de un anuncio (por ejemplo, activo, pausado o vendido).
   * @param id Id del anuncio.
   * @param status Nuevo estado del anuncio.
   * @returns Observable que emite el anuncio con el estado actualizado.
   */
  updateStatus(id: string, status: string): Observable<ListingResponse> {
    return this.http.patch<ListingResponse>(`${this.apiUrl}/${id}/status`, { status });
  }

  /**
   * Elimina un anuncio.
   * @param id Id del anuncio a eliminar.
   * @returns Observable que se completa cuando el anuncio ha sido eliminado.
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
