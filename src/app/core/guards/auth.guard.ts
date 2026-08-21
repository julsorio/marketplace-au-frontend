import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Guardamos a dónde iba el usuario para poder devolverlo ahí tras iniciar sesión
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};