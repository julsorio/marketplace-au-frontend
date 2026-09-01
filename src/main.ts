import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Punto de entrada de la aplicación.
 * Arranca la aplicación Angular en modo standalone (`bootstrapApplication`) usando el componente raíz
 * `App` y la configuración `appConfig` (providers, rutas, interceptors, detección de cambios zoneless).
 * Si el arranque falla, el error se registra en consola.
 */
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
