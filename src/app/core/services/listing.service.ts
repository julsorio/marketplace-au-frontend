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

  search(params: ListingSearchParams): Observable<ListingResponse[]> {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http.get<ListingResponse[]>(this.apiUrl, { params: httpParams });
  }

  // trackView solo debe ir a true desde la pantalla de detalle del anuncio (una visita real
  // del usuario); el resto de pantallas llama a este mismo método solo para enriquecer sus
  // listas con título/imagen del listing (conversaciones, transacciones), y eso no debe
  // contar como una visualización — por eso el valor por defecto es false.
  getById(id: string, trackView = false): Observable<ListingResponse> {
    const params = trackView ? new HttpParams().set('trackView', 'true') : undefined;
    return this.http.get<ListingResponse>(`${this.apiUrl}/${id}`, { params });
  }

  create(request: CreateListingRequest): Observable<ListingResponse> {
    return this.http.post<ListingResponse>(this.apiUrl, request);
  }

  update(id: string, request: UpdateListingRequest): Observable<ListingResponse> {
    return this.http.put<ListingResponse>(`${this.apiUrl}/${id}`, request);
  }

  updateStatus(id: string, status: string): Observable<ListingResponse> {
    return this.http.patch<ListingResponse>(`${this.apiUrl}/${id}/status`, { status });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}