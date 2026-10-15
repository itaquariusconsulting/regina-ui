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


  /* ── Rutas RELATIVAS, a proposito ────────────────────────────────────────
     Los cuatro backends viven en el mismo Tomcat que sirve esta pantalla, en
     contextos vecinos. Escribirlas relativas hace que el navegador las pida
     al MISMO host por el que entro: 192.168.2.9 desde la red interna,
     38.187.16.148 desde afuera, o el dominio que se le ponga manana.

     Con la IP privada escrita a mano, la app cargaba bien desde internet
     -el bundle lo sirve el Tomcat- pero ninguna llamada al backend llegaba a
     destino: el navegador del cliente intentaba alcanzar una direccion de
     nuestra LAN. El sintoma es una peticion en rojo sin codigo de estado,
     que no se parece en nada a un problema de configuracion.

     Consecuencia practica: el mismo WAR sirve para cualquier instalacion.
     No hay que recompilar el front para cambiar de servidor.             */
  apiUrlAuth:     '/regina-billing-concar',
  apiUrlProcess:  '/regina-process-concar/api/',
  apiUrlMaestros: '/regina-process-concar/api/',
  apiUrlOcr:      '/regina-process-concar/api',

  /* La IA es la unica que se comparte: no hay una instancia propia todavia.
     Mientras siga asi, el chat responde con el conocimiento de la otra
     instalacion. Para una demostracion no molesta; para un cliente real hay
     que levantarle la suya. */
  apiUrlIA:       '/reginaIA-1/ai'
};
