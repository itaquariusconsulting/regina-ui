import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withHashLocation,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';

import {
  provideEnvironmentNgxCurrency,
  NgxCurrencyInputMode,
} from 'ngx-currency';

import { routes } from './app.routes';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    /* ============================================================
       COMO SE TIPEA LA PLATA
       ------------------------------------------------------------
       ngx-currency trae por defecto el modo Financial: los digitos
       entran por la derecha, como una caja registradora. Apretar
       1, 5, 0 daba 1.50, y para cargar 150 habia que tipear 15000.

       Nadie lo configuro nunca, asi que los ocho campos de dinero
       de la aplicacion venian con ese comportamiento. El resultado
       son comprobantes cargados a mano con el monto cien veces mas
       chico: uno de 150 soles guardado como 1.50.

       En modo Natural se escribe el numero como se lee: 150 son
       150, y los centavos van despues del punto.

       OJO: esto NO corrige los comprobantes ya cargados. Los que
       se guardaron divididos por cien siguen divididos por cien.
    ============================================================ */
    provideEnvironmentNgxCurrency({
      inputMode: NgxCurrencyInputMode.Natural,
    }),

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
