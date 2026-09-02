/**
 * Una planilla de movilidad, tal como la devuelve el reporte.
 *
 * Es a proposito una vista corta: el reporte contesta "que planillas
 * registre en este rango", no el detalle de cada viaje. Quien quiere ver los
 * viajes entra a la planilla.
 */
export interface PlanillaMovilidadReporte {
  fechaPlanilla: string;
  numOrden: string;
  codPlanilla: string;

  /**
   * De quien es, segun la ORDEN DE PAGO. La cabecera de la planilla tiene su
   * propio COD_AUXILIAR_PERSONAL pero viene vacio en las 64 cargadas: el
   * frontend nunca lo grabo.
   */
  codAuxiliar: string;
  persona: string;

  viajes: number;
  total: number;
}

/** Lo que responde GET /api/rendicion/movilidad. */
export interface PlanillasDeMovilidad {
  planillas: PlanillaMovilidadReporte[];
  cuantas: number;
  viajes: number;
  gastado: number;

  /**
   * Si el que pregunta es admin. Lo decide el SERVIDOR leyendo la base, no
   * el sessionStorage: sirve para el rotulo de la pantalla, y de paso avisa
   * si alguien esta viendo mas o menos de lo que espera.
   */
  admin: boolean;
}
