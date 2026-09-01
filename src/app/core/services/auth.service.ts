import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, RefreshRequest } from '../models/auth.model';
import { UserSummary } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private readonly _currentUser = signal<UserSummary | null>(this.loadUserFromStorage());
  private readonly _accessToken = signal<string | null>(localStorage.getItem('accessToken'));

  readonly currentUser = this._currentUser.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  constructor(private http: HttpClient) {}

  /**
   * Registra un nuevo usuario en el sistema y, si tiene éxito, inicia sesión automáticamente
   * guardando el access token, el refresh token y los datos del usuario.
   * @param request Datos de registro (email, contraseña, nombre, etc.).
   * @returns Observable que emite la respuesta de autenticación (tokens y usuario).
   */
  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap(response => this.setSession(response))
    );
  }

  /**
   * Inicia sesión con email y contraseña, guardando la sesión resultante (tokens y usuario).
   * @param request Credenciales de inicio de sesión.
   * @returns Observable que emite la respuesta de autenticación (tokens y usuario).
   */
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => this.setSession(response))
    );
  }

  /**
   * Renueva el access token a partir del refresh token guardado en localStorage, y actualiza
   * la sesión con la respuesta.
   * @returns Observable que emite la nueva respuesta de autenticación (tokens y usuario).
   */
  refresh(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    const request: RefreshRequest = { refreshToken: refreshToken ?? '' };

    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, request).pipe(
      tap(response => this.setSession(response))
    );
  }

  /**
   * Cierra la sesión actual: borra los tokens y el usuario de localStorage y de los signals
   * en memoria.
   */
  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
    this._accessToken.set(null);
    this._currentUser.set(null);
  }

  /**
   * Devuelve el access token actual, o null si no hay sesión iniciada.
   * @returns El access token vigente, o null.
   */
  getAccessToken(): string | null {
    return this._accessToken();
  }

  private setSession(response: AuthResponse): void {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('currentUser', JSON.stringify(response.user));

    this._accessToken.set(response.accessToken);
    this._currentUser.set(response.user);
  }

  private loadUserFromStorage(): UserSummary | null {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  }
}
