/** Valoración media de un usuario y sobre cuántas reseñas se calcula. */
export interface Rating {
  average: number;
  count: number;
}

/** Resumen del usuario autenticado, tal como viene embebido en `AuthResponse`. */
export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
}

// Perfil público de otro usuario (sin email): quien envía un mensaje o publica un anuncio
export interface UserPublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string;
  rating: Rating;
}