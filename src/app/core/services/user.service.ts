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

  /**
   * Obtiene el perfil público de un usuario, usando una caché simple en memoria (Map de id a
   * Observable con shareReplay) para no pedir el mismo perfil público repetidas veces
   * mientras dura la sesión de la app: varias conversaciones pueden compartir el mismo
   * interlocutor, o este puede coincidir con el vendedor de un listing.
   * @param id Id del usuario.
   * @returns Observable que emite el perfil público del usuario (compartido entre
   * suscriptores gracias a shareReplay).
   */
  getPublicProfile(id: string): Observable<UserPublicProfile> {
    let cached = this.cache.get(id);
    if (!cached) {
      cached = this.http.get<UserPublicProfile>(`${this.apiUrl}/${id}`).pipe(shareReplay(1));
      this.cache.set(id, cached);
    }
    return cached;
  }
}
