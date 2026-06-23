/**
 * environment.prod.ts → se usa SOLO cuando el build se hace con
 *   ng build --configuration=production
 *
 * Distribución física de los backends:
 *
 *   Servidor "developer" (HTTP, mismo host del frontend):
 *     - regina-billing-dev   (autenticación + permisos)
 *     - regina-process-dev   (process + maestros)
 *
 *   Servidor "marcaciongps" (HTTPS, host externo dedicado):
 *     - sai-web-utils-dev    (utilitarios)
 *     - reginaIA-1           (servicio IA)
 *     - regina-ia            (OCR)
 *
 * Como el frontend se publica en HTTP, los servicios del developer se
 * referencian con HTTP (mismo origen → sin CORS ni PNA). Los servicios del
 * marcaciongps se mantienen en HTTPS porque allí solo están publicados
 * por TLS (8443). El navegador permite que una página HTTP llame a APIs
 * HTTPS — pero el marcaciongps DEBE incluir el origen del developer en
 * su lista CORS o las llamadas serán bloqueadas.
 */
export const environment = {
  production: true,

  // ── Servidor "developer" (mismo host del frontend, HTTP) ──────────────
  apiUrlAuth:     'http://developer.aquariusconsultores.com:21678/regina-billing-dev',
  apiUrlProcess:  'http://developer.aquariusconsultores.com:21678/regina-process-dev/api/',
  apiUrlMaestros: 'http://developer.aquariusconsultores.com:21678/regina-process-dev/api/',

  // ── Servidor "marcaciongps" (HTTPS, host externo) ─────────────────────
  apiUrlUtils:    'https://marcaciongps.aquariusconsultores.com:8443/sai-web-utils-dev/api/utils/',
  apiUrlIA:       'https://marcaciongps.aquariusconsultores.com:8443/reginaIA-1/ai',
  apiUrlOcr:      'https://marcaciongps.aquariusconsultores.com:8443/regina-ia',

  // CORE de seguridad — ya no se usa (Regina maneja su propio login),
  // se conserva el campo por compatibilidad con código que aún lo lea.
  coreApiUrl:     'http://developer.aquariusconsultores.com:21678/aquarius-security/api/v1'

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
