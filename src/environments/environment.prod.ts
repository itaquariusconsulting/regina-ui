/**
 * environment.prod.ts → se usa SOLO cuando el build se hace con
 *   ng build --configuration=production
 *
 * Arquitectura:
 *   - apiUrlAuth     → regina-api (Spring Boot) que expone /api/auth/me y
 *                      /api/auth/autenticar. NO va contra aquarius-security
 *                      porque ese gateway NO tiene esos endpoints.
 *   - coreApiUrl     → API del CORE de Seguridad (aquarius-security) usada
 *                      SOLO para /auth/introspect (validar token vivo).
 *   - resto de URLs  → cada backend en su path.
 *
 * Si la app se despliega EN PRODUCCIÓN PÚBLICA (marcaciongps:8443) hay que
 * cambiar la base por https://marcaciongps.aquariusconsultores.com:8443/...
 */
export const environment = {
  production: true,

  /* ========================================================
     AUTENTICACIÓN — regina-api (login + /me + permisos)
     Acá NO va aquarius-security: ese gateway no expone /api/auth/me.
  ======================================================== */
  apiUrlAuth: 'http://192.168.2.9:9080/regina-billing-dev',

  /* ========================================================
     RESTO DE SERVICIOS — PRODUCCIÓN LAN
  ======================================================== */
  apiUrlProcess:  'http://192.168.2.9:9080/regina-process-dev/api/',
  apiUrlUtils:    'https://marcaciongps.aquariusconsultores.com:8443/sai-web-utils-dev/api/utils/',
  apiUrlMaestros: 'http://192.168.2.9:9080/regina-process-dev/api/',
  apiUrlIA:       'https://marcaciongps.aquariusconsultores.com:8443/reginaIA-1/ai',
  apiUrlOcr:      'https://marcaciongps.aquariusconsultores.com:8443/regina-ia',

  // CORE de seguridad — solo se usa para /auth/introspect (verificar logout).
  // OJO: la UI del CORE vive en /aquarius-security-ui/ (con sufijo), pero
  // la API REST vive en /aquarius-security/ (SIN sufijo "-ui"). El error
  // CORS que vimos confirmó este path desde el server público.
  coreApiUrl:     'http://192.168.2.9:9080/aquarius-security/api/v1'

  /* ========================================================
     CONFIGURACIONES ANTERIORES — preservadas por si hay rollback
  ========================================================
  --- Anterior con regina-billing-dev (en LAN interna) ---
  apiUrlAuth:     'http://192.168.2.9:9080/regina-billing-dev',
  apiUrlProcess:  'http://192.168.2.9:9080/regina-process-dev/api/',
  apiUrlUtils:    "https://marcaciongps.aquariusconsultores.com:8443/sai-web-utils-dev/api/utils/",
  apiUrlMaestros: 'http://192.168.2.9:9080/regina-process-dev/api/',
  apiUrlIA:       'https://marcaciongps.aquariusconsultores.com:8443/reginaIA-1/ai',
  apiUrlOcr:      'https://marcaciongps.aquariusconsultores.com:8443/regina-ia',

  --- Anterior con IP pública 38.187.16.148 ---
  apiUrlAuth:     'http://38.187.16.148:21678/regina-billing-dev',
  apiUrlProcess:  'http://38.187.16.148:21678/regina-process-dev/api/',
  apiUrlUtils:    "http://38.187.16.148:21678/sai-web-utils-dev/api/utils/",
  apiUrlMaestros: 'http://38.187.16.148:21678/regina-process-dev/api/',
  apiUrlIA:       'http://38.187.16.148:21678/reginaIA-1/ai',
  apiUrlOcr:      'http://38.187.16.148:21678/regina-ia',
  ======================================================== */
};
