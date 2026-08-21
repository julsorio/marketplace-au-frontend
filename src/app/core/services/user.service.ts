import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserPublicProfile } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/user`;

  // Caché simple en memoria: varias conversaciones pueden compartir el mismo interlocutor
  // (o coincidir con el vendedor de un listing), así evitamos pedir el mismo perfil público
  // repetidas veces mientras dura la sesión de la app.
  private readonly cache = new Map<string, Observable<UserPublicProfile>>();

  getPublicProfile(id: string): Observable<UserPublicProfile> {
    let cached = this.cache.get(id);
    if (!cached) {
      cached = this.http.get<UserPublicProfile>(`${this.apiUrl}/${id}`).pipe(shareReplay(1));
      this.cache.set(id, cached);
    }
    return cached;
  }
}
