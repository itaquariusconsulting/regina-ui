/**
 * Un voucher de abono: el depósito con el que el trabajador devuelve el saldo
 * que le sobró de una orden de pago.
 *
 * Los campos son los de la pantalla del ERP (Tesorería → Transacciones →
 * Ingresos), porque eso es lo que contabilidad transcribe ahí. Lo que REGINA
 * no capture se lo van a tener que preguntar al trabajador por teléfono, que
 * es justo lo que esto viene a evitar.
 */
export interface AbonoRendicion {
  idRendAbono?: number;

  codEmpresa: string;
  codSucursal: string;
  numOrden: string;

  /** La que figura en el voucher del banco. */
  fecDeposito?: string;
  /** Con la que contabilidad lo registra. Puede diferir de la anterior. */
  fecMovimiento?: string;

  /** El banco es un auxiliar en el ERP. */
  codAuxiliarBco?: string;
  /** Nombre del banco, solo para mostrar. */
  desBanco?: string;

  /** Número de cuenta bancaria, NO la cuenta contable. */
  numCuentaBco?: string;
  /** ABONO EN CUENTA, cheque, efectivo. */
  codFormaPago?: string;
  numOperacion?: string;

  codMoneda?: string;
  impTipCambio?: number;
  impSoles?: number;
  impDolares?: number;

  archivoNombre?: string;
  archivoRuta?: string;

  /** 'S' cuando los datos los leyó el OCR y nadie los corrigió. */
  indOcr?: string;

  glosa?: string;

  indObservado?: string;
  codMotivoObs?: string;
  motivoObs?: string;

  indAnulado?: string;
  userIdAnula?: number;
  fecAnula?: string;

  userIdCrea?: number;
  fecCrea?: string;

  /** Nombre de quien lo cargó. */
  usuario?: string;

  /** Aviso de que ese número de operación ya estaba cargado. */
  avisoDuplicado?: string;
}

/** Lo que devuelve el listado: los abonos de una orden y el total válido. */
export interface AbonosDeOrden {
  abonos: AbonoRendicion[];
  /** Suma de los NO anulados. Lo calcula el backend. */
  devuelto: number;
}
