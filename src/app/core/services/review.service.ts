import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateReviewRequest, ReviewResponse } from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reviews`;

  // El backend valida: no autorreseñarse, que exista una transacción confirmada entre ambos
  // sobre ese anuncio, y que no exista ya una reseña de este reviewer a este reviewee para
  // ese anuncio (409 si se repite).
  create(request: CreateReviewRequest): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(this.apiUrl, request);
  }

  getReviewsForUser(userId: string): Observable<ReviewResponse[]> {
    return this.http.get<ReviewResponse[]>(`${this.apiUrl}/user/${userId}`);
  }
}
