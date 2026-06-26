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
  apiUrlUtils: "https://marcaciongps.aquariusconsultores.com:8443/sai-web-utils-dev/api/utils/",

  apiUrlProcess: 'https://developer.aquariusconsultores.com:8443/regina-process-dev/api/',
  apiUrlMaestros: 'https://developer.aquariusconsultores.com:8443/regina-process-dev/api/',
  apiUrlIA: 'https://developer.aquariusconsultores.com:8443/reginaIA-1/ai',
  apiUrlOcr: 'https://developer.aquariusconsultores.com:8443/regina-ia',

  // API del CORE de Seguridad (para verificar la sesión vía /auth/introspect y
  // así cerrar regina cuando el CORE hace logout, aunque el CORE siga abierto).
  coreApiUrl: 'http://127.0.0.1:14005/api/v1'

  /*  Producción (marcaciongps:8443)
    apiUrlAuth: 'https://marcaciongps.aquariusconsultores.com:8443/regina-billing-dev',
    apiUrlProcess: 'https://marcaciongps.aquariusconsultores.com:8443/regina-process-dev/api/',
    apiUrlUtils: "https://marcaciongps.aquariusconsultores.com:8443/sai-web-utils-dev/api/utils/",
    apiUrlMaestros: 'https://marcaciongps.aquariusconsultores.com:8443/regina-process-dev/api/',
    apiUrlIA: 'https://marcaciongps.aquariusconsultores.com:8443/reginaIA-1/ai',
    apiUrlOcr: 'https://marcaciongps.aquariusconsultores.com:8443/regina-ia'
  */

};