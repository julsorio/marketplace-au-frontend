import { UserSummary } from "./user.model";

/** Datos para registrar un nuevo usuario. */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
}

/** Credenciales para iniciar sesión. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Respuesta de login, registro o refresh: tokens de sesión y resumen del usuario autenticado. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

/** Cuerpo para pedir un nuevo access token a partir del refresh token vigente. */
export interface RefreshRequest {
  refreshToken: string;
}