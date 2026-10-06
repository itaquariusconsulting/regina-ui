/**
 * environment.concar.ts  →  se usa con  ng build --configuration=concar
 *
 * RENDIX CONCAR: la version sin ERP, la que se le instala a un cliente que
 * lleva su contabilidad en CONCAR.
 *
 * Apunta a sus PROPIOS backends, en contextos terminados en -concar. Conviven
 * en el mismo Tomcat del 2.9 con los de testing contra el ERP, que terminan en
 * -dev, para poder tener las dos versiones arriba a la vez sin bajar ninguna.
 *
 * Y detras de esos backends esta DB_RENDIX_CONCAR, que no comparte una sola
 * tabla con DB_REGINA_AQUIARIUS. Cargar una orden aca no se ve alla.
 */
export const environment = {

  production: true,

  /** Enciende el cartel de entorno. Se quita cuando haya una instalacion real. */
  demo: true,

  // ── Backends propios de RENDIX CONCAR ────────────────────────────────
  apiUrlAuth:     'http://192.168.2.9:9080/regina-billing-concar',
  apiUrlProcess:  'http://192.168.2.9:9080/regina-process-concar/api/',
  apiUrlMaestros: 'http://192.168.2.9:9080/regina-process-concar/api/',
  apiUrlOcr:      'http://192.168.2.9:9080/regina-process-concar/api',

  /* La IA es la unica que se comparte: no hay una instancia propia todavia.
     Mientras siga asi, el chat responde con el conocimiento de la otra
     instalacion. Para una demostracion no molesta; para un cliente real hay
     que levantarle la suya. */
  apiUrlIA:       'http://192.168.2.9:9080/reginaIA-1/ai'
};
