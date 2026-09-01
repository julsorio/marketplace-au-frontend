import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor HTTP funcional que centraliza el manejo de errores de las peticiones HTTP de la aplicación.
 * Si la API responde con un error 401 (no autorizado), cierra la sesión del usuario y lo redirige a la
 * pantalla de login; en cualquier caso, propaga el error original para que quien realizó la petición
 * pueda seguir gestionándolo.
 * @param req - Petición HTTP saliente.
 * @param next - Siguiente handler de la cadena de interceptors.
 * @returns El observable de la respuesta HTTP, o un observable que emite el error si la petición falla.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
