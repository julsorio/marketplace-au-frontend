/**
 * Forma estándar de error que devuelve la API (`GlobalExceptionHandler` en el backend).
 * `details` solo viene relleno en errores de validación, con un mensaje por campo inválido.
 */
export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  details?: string[];
}