import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Guard de autenticación de Regina.
 *
 * Regina maneja su propio login (sin SSO de aquarius-security).
 * La sesión vive en sessionStorage como:
 *   - isLoggedIn: 'true'
 *   - authToken : <JWT emitido por regina-api>
 *
 * Si el usuario no tiene sesión, se le redirige a /login (pantalla
 * tradicional de usuario+contraseña). Esto aplica TANTO en local como
 * en producción — eliminamos por completo el flujo SSO con CORE.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  const hasToken   = !!sessionStorage.getItem('authToken');

  if (isLoggedIn && hasToken) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
