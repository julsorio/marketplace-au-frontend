# frontend-marketplace

Frontend Angular 22.1 del marketplace. Signals, componentes standalone, **Zoneless** (sin zone.js), Angular Material, formularios reactivos tipados, `inject()` para DI, rutas lazy vía `loadComponent`. Testing con Vitest (no Karma/Jasmine). Mapa/geolocalización con Leaflet (`leaflet` + `@types/leaflet`).

## Comandos

- `npm start` → `ng serve` (puerto 4200)
- `npm run build` → `ng build`
- `npm test` → Vitest

## Iconos

`index.html` carga la fuente clásica **"Material Icons"** (`family=Material+Icons`), no "Material Symbols". Cualquier ligature usada en `<mat-icon>` o en datos (p. ej. el campo `icon` de categorías) debe pertenecer a ese set clásico.

## Patrones de RxJS establecidos

- `forkJoin` para enriquecer datos en paralelo (p. ej. `conversation-list.ts` trae título/imagen del listing + nombre del otro participante en paralelo).
- `catchError` va **dentro** del observable interno de un `switchMap`/`forkJoin`, nunca fuera — patrón fijado tras varios bugs previos en la sesión.
- Formularios reactivos tipados: `form.value.campo` puede salir `T | null | undefined` aunque el modelo destino espere `T | null` — usar `?? null` al pasarlo a un `@Input()` más estricto (pasó con `LocationPicker.initialLatitude/initialLongitude`).

## Gotcha ya resuelto (para no repetirlo)

Al añadir un componente nuevo a una plantilla, **no basta con importar el tipo** (p. ej. `LocationPicked`) — hay que añadir la **clase del componente** (`LocationPicker`) también al array `imports:` del `@Component`. Un olvido de esto causó un NG8002 real en `listing-form.ts`.

## Funcionalidades completadas recientemente (para no re-implementarlas)

- Perfil público de usuario con rating (`features/users/user-profile/`), enlazado desde el chip del vendedor en `listing-detail` y desde el formulario de reseña inline en `transactions-list` (transacciones confirmadas).
- Selector de método de entrega (`shipping` | `in_person` | `both`) en `listing-form`, con chip + icono (`local_shipping` / `handshake` / `sync_alt`) en `listing-detail`.
- Guard anti-auto-mensaje: `conversation-thread.ts` redirige con snackbar si `recipientId === myId` al crear una conversación nueva por URL directa (la UI normal ya oculta el botón "Contactar al vendedor" al dueño del listing, esto cubre el acceso directo por URL).
- `listingService.getById(id, trackView = false)` — **solo** `listing-detail.ts` llama con `trackView = true`; el resto de pantallas (conversaciones, transacciones, formulario de edición) usan el default `false` para no inflar el contador de vistas.

## Categorías

`CategoryService` carga `GET /categories` (árbol de 2 niveles: raíces + un nivel de subcategorías) y lo cachea en un signal (`loadCategories()` es idempotente vía flag `loaded`). Los `<mat-select>` de categoría/subcategoría en `listing-list` y `listing-form` usan `cat.id` como value y `cat.name` como label — el campo `icon` **llega en la respuesta pero todavía no se pinta en ningún template**, queda disponible para cuando se quiera mostrar.

## Pendiente

- Pasarela de pago con tarjeta (el pago en persona ya funciona en el flujo de transacciones).
