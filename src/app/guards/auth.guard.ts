import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

/**
 * URL del catálogo del CORE de Seguridad (aquarius-security-ui).
 * Cuando un usuario entra DIRECTO a Regina en producción sin sesión, se le
 * redirige aquí para que se loguee y vuelva con el traspaso #sso=.
 */
const CORE_CATALOG_URL = 'http://192.168.2.9:9080/aquarius-security-ui/catalog';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);

  // === MODO LOCAL / DESARROLLO ===
  // No hay CORE corriendo en local; usamos el login tradicional contra
  // regina-billing-dev (la pantalla /login con usuario y contraseña).
  if (!environment.production) {
    const isLoggedInLocal = sessionStorage.getItem('isLoggedIn') === 'true';
    const hasTokenLocal   = !!sessionStorage.getItem('authToken');
    if (isLoggedInLocal && hasTokenLocal) {
      return true;
    }
    return router.createUrlTree(['/login']);
  }

  // === MODO PRODUCCIÓN ===
  // Espera a que termine la ingesta del token del CORE (idempotente). Evita
  // la carrera con la navegación inicial: sin esto, el guard se evaluaba
  // antes de que /auth/me rearmara la sesión y caía siempre en /no-core.
  await auth.initFromCore();

  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  const hasToken   = !!sessionStorage.getItem('authToken');

  if (isLoggedIn && hasToken) {
    return true;
  }

  // Sin sesión del CORE.
  // Si el usuario entró DIRECTO (sin pasar por el catálogo), no había #sso=
  // y la app cayó acá. En lugar de mostrar la pantalla bloqueante /no-core,
  // lo redirigimos al catálogo del CORE para que se loguee y vuelva con el
  // traspaso. Usamos `replace` para no dejar la URL de Regina en el historial.
  const yaEnNoCore = window.location.hash.includes('/no-core');
  if (!yaEnNoCore) {
    console.warn('[authGuard] No hay sesión del CORE → redirigiendo al catálogo');
    window.location.replace(CORE_CATALOG_URL);
    return false;
  }

  // Si por alguna razón el redirect no se ejecutó, mostramos el bloqueo.
  return router.createUrlTree(['/no-core']);
};
