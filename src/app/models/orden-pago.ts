export class OrdenPago {
  codEmpresa?: string;
  codSucursal?: string;
  anoPeriodo?: string;
  codPeriodo?: string;
  numOrden?: string;

  fecOrden?: Date;
  codMoneda?: string;
  tipCambio?: number;
  impSoles?: number;
  impDolares?: number;
  glosa?: string;
  tipEstado?: string;

  /**
   * Estado de la rendicion en REGINA: 'ABIERTA', 'RENDIDA' o undefined.
   *
   * No viene del ERP —contabilidad no sabe nada de esto— sino de REG_REND_CAB.
   * undefined significa que la orden nunca se rindio por REGINA: o esta sin
   * empezar, o es anterior a que existiera la antesala.
   */
  estadoRendicion?: string;
  codAuxiliar?: string;
  codPeriodoVou?: string;
  anoPeriodoVou?: string;
  codTipoComprobante?: string;
  numFile?: string;
  numVoucher?: string;
  codRubro?: string;
  codTipoGasto?: string;
  codUsuario?: string;
  fecActualiza?: Date;
  nroReferencia?: string;
  numVerPlanCuentas?: string;
  codCuenta?: string;
  fecRendicion?: Date;
  numDiasRendicion?: number;
  impOrdPago?: number;
  impLiqBase?: number;
  impLiqSecun?: number;
  codCCostos?: string;

  // Campos calculados (subselects)
  cdesMoneda?: string;
  cdesAuxiliar?: string;
  cdesTipoGasto?: string;
  /** Lo PUBLICADO al ERP (CXP_ORDEN_PAGO_DET). Cero hasta que se envia. */
  impRendidoSoles?: number;
  impRendidoDolares?: number;

  /**
   * Lo SUBIDO en REGINA (REG_REND_DET), este publicado o no.
   *
   * Va al lado del anterior, no lo reemplaza: uno es el avance del
   * trabajador y el otro es lo que contabilidad ya tiene. Cuando difieren,
   * hay algo cargado y sin enviar.
   */
  impCargadoSoles?: number;
  impCargadoDolares?: number;

  /** Cuantos comprobantes lleva subidos, publicados o no. */
  comprobantesCargados?: number;
}
