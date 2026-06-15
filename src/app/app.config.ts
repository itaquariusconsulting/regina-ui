import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject, isDevMode } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withHashLocation, withInMemoryScrolling, withRouterConfig, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(
      routes,
      withRouterConfig({
        onSameUrlNavigation: 'reload'
      }),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled'
      }),
      withEnabledBlockingInitialNavigation(),
      withViewTransitions(),
      withHashLocation()
    ),// Necesario para que ngx-bootstrap funcione// Provee el módulo del modal // Agregar el servicio del modal manualmente
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true // Permitir múltiples interceptores
    },

    // SSO: antes de arrancar el router, ingiere el traspaso #sso del CORE y,
    // si hay token, arma la sesión (usuario/perfil/permisos) desde /api/auth/me.
    provideAppInitializer(() => inject(AuthService).initFromCore()),

    provideZoneChangeDetection({ eventCoalescing: true }),

    // ⚠️ IMPORTANTE: NO volver a llamar a provideRouter(routes) aquí.
    // El provideRouter de arriba ya configura el routing con:
    //   - withHashLocation()                  (URL con # — para SSO #sso=)
    //   - withEnabledBlockingInitialNavigation() (espera APP_INITIALIZER)
    // Si se duplica, esta segunda llamada sobrescribe esa configuración
    // y el guard se evalúa ANTES de que initFromCore() termine de leer el
    // token del CORE → cae siempre en /no-core.

    provideServiceWorker('ngsw-worker.js', {
      // 🚨 DESACTIVADO TEMPORALMENTE.
      // El Service Worker viejo seguía sirviendo el bundle anterior con URLs
      // a marcaciongps.aquariusconsultores.com:8443 incluso después de
      // redespliegues. Lo dejamos OFF hasta confirmar que el flujo SSO con
      // CORE (aquarius-security) funciona correctamente. Para reactivar:
      //   enabled: !isDevMode(),
      enabled: false,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};

