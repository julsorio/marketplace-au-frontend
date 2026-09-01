import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';


/**
 * Interceptor HTTP funcional que añade el access token del usuario autenticado como cabecera
 * `Authorization: Bearer` en las peticiones salientes.
 * No añade el token a las peticiones de los propios endpoints de autenticación (login/register/refresh),
 * para evitar mandar un token viejo o inválido en esas llamadas específicas.
 * @param req - Petición HTTP saliente.
 * @param next - Siguiente handler de la cadena de interceptors.
 * @returns El observable de la respuesta HTTP, con el token añadido en la cabecera cuando corresponde.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  const isAuthEndpoint = req.url.includes('/auth/login')
    || req.url.includes('/auth/register')
    || req.url.includes('/auth/refresh');

  if (token && !isAuthEndpoint) {
    const clonedRequest = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(clonedRequest);
  }

  return next(req);
};
