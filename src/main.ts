import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
//import { defineCustomElements } from 'aquarius-controls/loader';
import { provideServiceWorker } from '@angular/service-worker';
import { environment } from './environments/environment';
import { appConfig } from './app/app.config'; // tu configuración adicional si es que tiene providers, imports, etc.
import { enableProdMode } from '@angular/core';


if (environment.production) {
  enableProdMode();

  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

/**
 * Ingesta del traspaso SSO del CORE (#sso=<base64url>) ANTES de arrancar
 * Angular. regina usa HASH ROUTING (#/...), así que un fragmento "#sso=..."
 * choca con el router (lo toma como ruta -> NG04002). Aquí lo leemos, guardamos
 * el token/usuario/contexto en sessionStorage y limpiamos el hash a "#/" para
 * que el router reciba una ruta válida. El AuthService luego rearma la sesión
 * leyendo authToken desde sessionStorage.
 */
(function ingestSsoBeforeBootstrap(): void {
  try {
    // El '=' del "sso=" puede venir url-encodeado como %3D en el hash; decodifica.
    const raw = decodeURIComponent((window.location.hash || '') + '&' + (window.location.search || ''));
    const m = raw.match(/sso=([^&]+)/);
    if (!m) return;

    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const bin = atob(b64 + pad);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as { a?: string; u?: string; c?: string };

    if (data.a) sessionStorage.setItem('authToken', data.a);
    if (data.u) sessionStorage.setItem('sg.user', data.u);
    if (data.c) sessionStorage.setItem('sg.context', data.c);
  } catch {
    /* sso malformado: el guard caerá en /no-core */
  } finally {
    // Deja una ruta de hash limpia pase lo que pase (evita el NG04002). El '='
    // puede venir codificado como %3D, por eso probamos ambas formas.
    if (/sso(=|%3d)/i.test(window.location.hash || '')) {
      history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
    }
  }
})();

bootstrapApplication(AppComponent, {
  ...appConfig, // spread de tu configuración existente
  providers: [
    ...(appConfig.providers || []), // mantener otros providers si los tienes
    ...(environment.production ? [provideServiceWorker('ngsw-worker.js')] : []),
  ],
})
  .catch((err) => console.error(err));

//defineCustomElements(window);
