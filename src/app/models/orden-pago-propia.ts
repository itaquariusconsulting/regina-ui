/**
 * Una orden de pago por rendir, de las que nacen en RENDIX.
 *
 * En la versión de Aquarius la OP viene del ERP. En RENDIX CONCAR no hay ERP
 * del otro lado: se carga acá, y por eso la cabecera lleva a quién se le
 * entregó el dinero, cuánto y cuándo.
 */
export interface OrdenPagoPropia {

  codEmpresa?: string;
  codSucursal?: string;

  /** Nueve dígitos con ceros a la izquierda. Lo asigna el servidor. */
  numOrden?: string;

  anoPeriodo?: string;
  codPeriodo?: string;

  /** ISO, yyyy-MM-dd. */
  fecOrden?: string;

  /** A quién se le entregó. Código de anexo. */
  codAuxiliar?: string;
  /** Solo para mostrar: no se envía al grabar. */
  desAuxiliar?: string;

  glosa?: string;
  codMoneda?: string;
  impOrdPago?: number;
  codCCostos?: string;
  codTipoGasto?: string;

  /** PE pendiente de rendir, RE rendida, LI liquidada. */
  tipEstado?: string;

  /* --- lo que calcula el servidor: no se envía --- */

  impRendido?: number;
  numComprobantes?: number;
  numPlanillas?: number;
  numDevoluciones?: number;
  saldo?: number;

  /**
   * Si todavía se puede tocar. Lo decide el servidor, no la pantalla: una OP
   * con comprobantes cargados no se edita ni se borra.
   */
  editable?: boolean;

  /** Por qué no se puede, cuando editable es false. Se muestra en el tooltip. */
  motivoNoEditable?: string;
}

/** Lo que la pantalla usa para buscar. Todo opcional menos empresa y sucursal. */
export interface FiltroOrdenPagoPropia {
  anio?: string;
  mes?: string;
  numOrden?: string;
  persona?: string;
  estado?: string;
}
