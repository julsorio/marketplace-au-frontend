import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard de ruta que protege el acceso a las rutas que requieren un usuario autenticado.
 * Si el usuario no está autenticado, lo redirige a la pantalla de login guardando la URL a la
 * que intentaba acceder en el query param `returnUrl`, para poder devolverlo ahí una vez
 * complete el inicio de sesión.
 * @param _route - Snapshot de la ruta activada (no se utiliza).
 * @param state - Estado del router en el momento de la navegación; se usa `state.url` para construir el `returnUrl`.
 * @returns `true` si el usuario está autenticado y puede continuar la navegación; `false` en caso contrario.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
