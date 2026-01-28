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

  // Campos calculados (subselects)
  cDesMoneda?: string;
  cDesAuxiliar?: string;
  cDesTipoGasto?: string;
  cDesTado?: string;
}
