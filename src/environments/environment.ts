export const environment = {
  production: false,
  apiUrl: 'http://localhost:8002/marketplace-api/v1',
  geocodingApiUrl: 'https://nominatim.openstreetmap.org',
  // Clave publicable de PRUEBA de Stripe (pk_test_...). No es secreta, pero cada desarrollador usa
  // la de su cuenta. Vacía = el pago con tarjeta muestra un aviso en vez del formulario.
  stripePublishableKey: 'pk_test_51UT9NSP7MbLf6D8EwsqKS8ww6X4knLn1mpYlUDbOrvFpF8YBr3a4zDPRXCKEusQDNbi67ICgeCEJ82yvobBE2PFc00cBJGYFMa'
};
