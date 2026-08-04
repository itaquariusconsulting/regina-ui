import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withHashLocation,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(
      routes,
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
      withEnabledBlockingInitialNavigation(),
      withViewTransitions(),
      withHashLocation(),
    ),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },

    // 🟢 La autenticación SSO con aquarius-security fue retirada.
    // Regina maneja su propio login (pantalla /login → regina-api).
    // Por eso ya no usamos `provideAppInitializer(... initFromCore() ...)`.

    provideZoneChangeDetection({ eventCoalescing: true }),

    // El service worker se registra en main.ts, solo para produccion.
    // Aca estaba declarado por duplicado y ademas con enabled:false, lo
    // que hacia dificil entender cual de los dos mandaba.
  ],
};
