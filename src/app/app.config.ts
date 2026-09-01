import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptors';
import { errorInterceptor } from './core/interceptors/error.interceptor';

/**
 * Configuración raíz de la aplicación, usada por `bootstrapApplication` en `main.ts`.
 *
 * Providers registrados:
 * - `provideBrowserGlobalErrorListeners`: captura y reporta errores globales no gestionados del navegador.
 * - `provideZonelessChangeDetection`: activa la detección de cambios sin Zone.js (zoneless); la vista se
 *   actualiza a partir de los Signals en vez de depender del parcheo de APIs del navegador que hace Zone.js.
 * - `provideRouter(routes)`: registra el router de Angular con las rutas de la aplicación.
 * - `provideHttpClient(withInterceptors([...]))`: registra el cliente HTTP junto con los interceptors
 *   `authInterceptor` (añade el token de acceso) y `errorInterceptor` (manejo centralizado de errores HTTP).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor]))
  ]
};
