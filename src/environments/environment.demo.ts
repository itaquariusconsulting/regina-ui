/**
 * environment.demo.ts  →  se usa con  ng build --configuration=demo
 *
 * ENTORNO DE DEMOSTRACION. Es el unico archivo de entorno que apunta
 * fuera de produccion, y existe para que la vista previa de /rendix se
 * pueda mostrar y TOCAR sin que nada llegue a los datos reales.
 *
 * A donde apunta
 * --------------
 *   REGINA        base en 192.168.2.9\SQL2019STD
 *   CONTABILIDAD  base en 192.168.2.10\SQL2014
 *
 * El front no habla con las bases: habla con los backends del 2.9, que
 * son los que tienen esas cadenas de conexion. Estas URLs salen del
 * historial de environment.prod.ts, cuando el proyecto apuntaba ahi.
 *
 * Por que un archivo aparte y no un "if"
 * --------------------------------------
 * Un flag en el codigo se puede quedar prendido. Esto no: el build de
 * produccion reemplaza environment.ts por environment.prod.ts y estas
 * direcciones NO EXISTEN en ese binario. Es imposible que produccion
 * termine apuntando aca por accidente.
 *
 * ANTES DE USARLO, VERIFICAR DOS COSAS
 * ------------------------------------
 *  1. Que los backends del 2.9 esten levantados y con el codigo al dia.
 *     Si quedaron en una version vieja, las pantallas nuevas -las
 *     aprobaciones de contabilidad, sobre todo- van a dar 404.
 *
 *  2. Que sus cadenas de conexion apunten al 2.9 y al 2.10, y no al 248
 *     ni al SRVAQC05. Al clonar una maquina la cadena viaja dentro del
 *     WAR, asi que un backend "de prueba" puede estar escribiendo en
 *     produccion. Se ve igual de bien hasta que alguien nota el
 *     movimiento.
 */
export const environment = {
  production: true,

  // ── Backends de REGINA, en el servidor de demostracion ────────────────
  apiUrlAuth:     'http://192.168.2.9:9080/regina-billing-dev',
  apiUrlProcess:  'http://192.168.2.9:9080/regina-process-dev/api/',
  apiUrlMaestros: 'http://192.168.2.9:9080/regina-process-dev/api/',

  // El OCR va por REGINA-API-PROCESS, asi que sigue al mismo servidor.
  apiUrlOcr:      'http://192.168.2.9:9080/regina-process-dev/api',

  // OJO: la IA nunca estuvo desplegada en el 2.9 -en el historial
  // siempre apunto al 248-. Se la deja aqui a proposito: si el contexto
  // no existe, el chat falla y se nota; apuntarla a produccion haria que
  // la demo escriba en la base de chat real sin que nadie lo vea.
  apiUrlIA:       'http://192.168.2.9:9080/reginaIA-1/ai'
};
