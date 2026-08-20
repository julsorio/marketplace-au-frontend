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

  getById(id: string): Observable<ListingResponse> {
    return this.http.get<ListingResponse>(`${this.apiUrl}/${id}`);
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