/**
 * Una orden de pago del ERP con lo que REGINA sabe de ella.
 *
 * La fila existe aunque REGINA no sepa nada: esas son las que hay que
 * perseguir, y son justamente las que un reporte armado desde REGINA no puede
 * mostrar.
 */
export interface OpCruce {
  numOrden: string;
  fecOrden?: string;
  anoPeriodo?: string;
  codPeriodo?: string;

  codAuxiliar?: string;
  desAuxiliar?: string;

  codCCostos?: string;
  desCCostos?: string;

  glosa?: string;
  codMoneda?: string;
  desMoneda?: string;

  impOrdPago: number;
  impRendido: number;
  saldo: number;

  /** EM, PE o LQ. */
  tipEstado?: string;
  desEstado?: string;

  /** Si alguien abrió la rendición en REGINA. */
  tieneRendicion: boolean;

  estProceso?: string;
  etiquetaProceso?: string;

  fecEnvio?: string;
  fecRecepcion?: string;
  fecLiquida?: string;

  comprobantes?: number;
  observados?: number;

  diasSinRendir?: number;
}

/** Lo que se manda al backend. Todo opcional menos empresa y sucursal. */
export class FiltroCruce {
  numOrden: string = '';
  persona: string = '';
  desde: string = '';
  hasta: string = '';
  codCCostos: string = '';
  /** EM | PE | LQ | '' */
  tipEstado: string = '';
  /** CON | SIN | '' */
  situacion: string = '';
  /** PENDIENTE | EN_PROCESO | RECEPCIONADO | OBSERVADO | LIQUIDADO | '' */
  estProceso: string = '';
}
