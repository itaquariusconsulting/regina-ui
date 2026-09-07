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
  apiUrlIA:       'https://marcaciongps.aquariusconsultores.com:8443/reginaIA-1/ai',
  apiUrlOcr:      'https://marcaciongps.aquariusconsultores.com:8443/regina-ia'

  // Aca vivian apiUrlUtils (sai-web-utils) y coreApiUrl (aquarius-security).
  // Se quitaron porque no los llamaba nadie: el padron RUC pasó al cache de
  // REGINA y el SSO se retiró hace tiempo. Dejarlos hacia creer que REGINA
  // dependia de dos servicios de los que ya no depende.
};
