export const environment = {
  production: false,

  // === Backends de DESARROLLO ===
  // Auth/permisos: regina-api LOCAL (sin context-path, puerto 8080).
  apiUrlAuth: 'https://developer.aquariusconsultores.com:8443/regina-billing-dev',
  // ⚠️ IMPORTANTE: REGINA-API-PROCESS corre en puerto 1111 con context-path
  // /regina-process-dev (ver application.properties). La URL completa de la API es:
  //   http://localhost:1111/regina-process-dev/api/...
  //apiUrlProcess: 'http://localhost:1111/regina-process-dev/api/',
  //apiUrlMaestros: 'http://localhost:1111/regina-process-dev/api/',
  apiUrlProcess: 'https://developer.aquariusconsultores.com:8443/regina-process-dev/api/',
  apiUrlMaestros: 'https://developer.aquariusconsultores.com:8443/regina-process-dev/api/',
  apiUrlIA: 'https://developer.aquariusconsultores.com:8443/reginaIA-1/ai',
  apiUrlOcr: 'https://developer.aquariusconsultores.com:8443/regina-ia'

  // apiUrlUtils (sai-web-utils) y coreApiUrl (aquarius-security) se quitaron:
  // ningun servicio los llamaba. El padron RUC vive ahora en el cache de
  // REGINA y el SSO se retiró.

  /*  Producción (marcaciongps:8443)
    apiUrlAuth: 'https://marcaciongps.aquariusconsultores.com:8443/regina-billing-dev',
    apiUrlProcess: 'https://marcaciongps.aquariusconsultores.com:8443/regina-process-dev/api/',
    apiUrlMaestros: 'https://marcaciongps.aquariusconsultores.com:8443/regina-process-dev/api/',
    apiUrlIA: 'https://marcaciongps.aquariusconsultores.com:8443/reginaIA-1/ai',
    apiUrlOcr: 'https://marcaciongps.aquariusconsultores.com:8443/regina-ia'
  */

};
