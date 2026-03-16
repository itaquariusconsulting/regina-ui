export class OrdenPagoDetDTO {

  codEmpresa?: string;
  codSucursal?: string;
  numOrden?: string;
  numItemOp?: string;

  numVerPlanCuentas?: string;
  codCuentaDocumento?: string;
  codCuentaConcepto?: string;
  codAuxiliar?: string;
  codEquipo?: string;
  numVerCCostos?: string;
  codCCostos?: string;
  numFase?: string;
  codRubro?: string;
  codTipoGasto?: string;

  impSoles?: number;
  impDolares?: number;

  indDebeHaber?: string;
  codDocumento?: string;
  numSerieDoc?: string;
  numDocumento?: string;
  codMoneda?: string;

  fecDocumento?: Date;

  nroPoliza?: string;
  tipCambio?: number;
  glosa?: string;

  impImponSoles?: number;
  impImponDolares?: number;
  impExonSoles?: number;
  impExonDolares?: number;
  impAjusteSoles?: number;
  impAjusteDolares?: number;

  numDocRef?: string;
  fecDocRef?: Date;

  estDocIng?: string;
  numLte?: number;

  indDet?: string;
  numDet?: string;
  fecDet?: Date;
  impDet?: number;

  codDepAduanera?: string;
  anoEmisionDua?: string;
  numDua?: string;

  impBolsaBase?: number;
  impBolsaSecun?: number;

  impRedondeoBase?: number;
  impRedondeoSecun?: number;

  anoProcesoDeclara?: string;
  mesProcesoDeclara?: string;

}
