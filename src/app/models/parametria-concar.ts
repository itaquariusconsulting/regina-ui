/** Una fila de REG_CONCAR_CONFIG: un parámetro del asiento. */
export interface ParametroConcar {
  codEmpresa?: string;
  clave: string;
  valor: string;
  descripcion?: string;

  /**
   * 'S' mientras el valor sea una suposición nuestra.
   *
   * Es lo que la pantalla pinta en ámbar. Pasa a 'N' sola al guardar: eso ya
   * es una persona de contabilidad mirando el valor.
   */
  indProvisional?: string;
  fecModifica?: string;
}

/** Una fila de REG_CONCAR_CUENTA. */
export interface CuentaGasto {
  codEmpresa?: string;
  codTipoGasto: string;
  descripcion?: string;
  cuentaGasto: string;
  indCCostos?: string;
  indAnexo?: string;
  indProvisional?: string;
  fecModifica?: string;
}

/** Una fila de REG_CONCAR_EQUIVALENCIA. */
export interface EquivalenciaConcar {
  codEmpresa?: string;
  tipo: string;
  valorErp: string;
  valorConcar: string;
  descripcion?: string;
  indProvisional?: string;
  fecModifica?: string;
}

/** Una fila de MAE_TIPO_CAMBIO. */
export interface TipoCambio {
  fecha: string;
  compra?: number;
  venta?: number;
  /** 'A' automático del servicio, 'M' cargado a mano. */
  origen?: string;
}

/** El resumen de una puesta al día del tipo de cambio. */
export interface ResultadoTipoCambio {
  traidos: string[];
  yaEstaban: string[];
  fallados: string[];
  detalle?: string;
}
