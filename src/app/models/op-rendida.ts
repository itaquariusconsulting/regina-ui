/**
 * Una orden de pago ya rendida, como la ve contabilidad.
 *
 * Rendida significa una sola cosa: que el usuario aprobó el envío desde
 * REGINA. No alcanza con que la orden tenga comprobantes en el ERP —eso
 * también pasa mientras el usuario todavía está cargando— ni con el estado
 * del ERP, que recién se mueve cuando contabilidad liquida.
 */
export class OpRendida {
  codEmpresa?: string;
  codSucursal?: string;
  numOrden?: string;

  /** Periodo contable de la orden: es el año y mes por el que se filtra. */
  anoPeriodo?: string;
  codPeriodo?: string;

  fecOrden?: string;
  codAuxiliar?: string;
  desAuxiliar?: string;
  glosa?: string;
  codMoneda?: string;
  desMoneda?: string;
  impOrdPago?: number;

  impRendidoSoles?: number;
  impRendidoDolares?: number;

  /** Estado en el ERP: 'PE' mientras no se liquide, 'LQ' después. */
  tipEstado?: string;

  /** Cuándo el usuario aprobó el envío a contabilidad. */
  fecRendicion?: string;
  userIdRinde?: number;
  /** Cuántos comprobantes viajaron al ERP. Sirve para cuadrar. */
  numComprobantes?: number;

  /**
   * Dónde va dentro de contabilidad: vacío = sin tomar, RECEPCIONADA,
   * EN_PROCESO o LIQUIDADA. Lo registra REGINA porque el ERP no guarda
   * cuándo cambia de estado.
   */
  estProceso?: string;
  fecLiquida?: string;
  /** Comprobantes que contabilidad marcó como que no sustentan. */
  observados?: number;
}

/** Los filtros de la pantalla. Vacío quiere decir "no filtrar por esto". */
export class FiltroOpRendida {
  numOrden?: string = '';
  persona?: string = '';
  anio?: string = '';
  mes?: string = '';
}
