/**
 * environment.prod.ts  →  se usa con  ng build --configuration=production
 *
 * PRODUCCION: servidor MARCACION-GPS (192.168.50.248), publicado como
 * https://marcaciongps.aquariusconsultores.com:8443
 *
 * Los contextos conservan el sufijo "-dev" porque asi se llaman los WAR
 * (viene del <finalName> del pom.xml). Es historico, no indica entorno.
 *
 * Las configuraciones anteriores (developer:8443, 192.168.2.9:9080,
 * 38.187.16.148:21678) estan en el historial de Git si hicieran falta.
 */
export const environment = {
  production: true,

  // ── Backends de REGINA ────────────────────────────────────────────────
  apiUrlAuth:     'https://marcaciongps.aquariusconsultores.com:8443/regina-billing-dev',
  apiUrlProcess:  'https://marcaciongps.aquariusconsultores.com:8443/regina-process-dev/api/',
  apiUrlMaestros: 'https://marcaciongps.aquariusconsultores.com:8443/regina-process-dev/api/',

  // ── Servicios de apoyo ────────────────────────────────────────────────
  apiUrlUtils:    'https://marcaciongps.aquariusconsultores.com:8443/sai-web-utils-dev/api/utils/',
  apiUrlIA:       'https://marcaciongps.aquariusconsultores.com:8443/reginaIA-1/ai',
  apiUrlOcr:      'https://marcaciongps.aquariusconsultores.com:8443/regina-ia',

  // CORE de seguridad — segun el codigo ya no se usa (REGINA maneja su propio
  // login); se conserva el campo por compatibilidad.
  coreApiUrl:     'https://marcaciongps.aquariusconsultores.com:8443/aquarius-security/api/v1'
};
