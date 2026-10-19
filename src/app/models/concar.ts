/**
 * El asiento que RENDIX le entrega a CONCAR.
 *
 * CONCAR no tiene API: la integracion es un Excel de 40 columnas que
 * contabilidad sube a mano, y que el propio CONCAR valida al importar. Estos
 * tipos son el espejo de lo que devuelve /api/rendicion/concar.
 */

/** Un reparo del validador, con la misma forma que los mensajes de CONCAR. */
export interface ObservacionConcar {
  /** ERROR frena la descarga. AVISO la deja pasar. */
  nivel: 'ERROR' | 'AVISO';
  /** Fila del Excel contando el encabezado. 0 si el reparo es general. */
  fila: number;
  /** La columna del formato, con el nombre que usa CONCAR. */
  columna?: string;
  mensaje: string;
  /** De donde sale la fila: "comprobante FT F001-123". */
  origen?: string;
}

/** Una linea del asiento, para mostrarla antes de bajar el archivo. */
export interface LineaAsientoConcar {
  subDiario?: string;
  numComprobante?: string;
  fechaComprobante?: string;
  codMoneda?: string;
  glosaPrincipal?: string;
  cuentaContable?: string;
  codAnexo?: string;
  codCentroCosto?: string;
  debeHaber?: string;
  importeOriginal?: number;
  importeSoles?: number;
  tipoDocumento?: string;
  numDocumento?: string;
  fechaDocumento?: string;
  glosaDetalle?: string;
  tasaIgv?: number;
  /** No viaja al Excel: sirve para saber de que comprobante salio la fila. */
  origen?: string;
}

/** Lo que devuelve /revisar: el asiento armado y sus reparos. */
export interface RevisionConcar {
  /** Solo viene en la revision del mes: de que OP es este asiento. */
  numOrden?: string;
  numComprobante: string;
  lineas: number;
  totalDebe: number;
  totalHaber: number;
  puedeExportar: boolean;
  observaciones: ObservacionConcar[];
  detalle: LineaAsientoConcar[];
}

/**
 * Lo que la pantalla manda para armar el archivo del mes.
 *
 * Las ordenes no se juntan solas: el usuario marca cuales van. Asi puede
 * dejar afuera la que todavia discute con contabilidad y rearmar el archivo
 * despues sin esperar a que se resuelva.
 */
export interface LlaveMesConcar {
  codEmpresa: string;
  codSucursal: string;
  anioPeriodo: string;
  codPeriodo: string;
  ordenes: string[];
  /** Opcional. Si va vacio, el servidor lo arma con el patron parametrizado. */
  numDocumento?: string;
  /** Iniciales de quien exporta, para ese patron. */
  iniciales?: string;
}

/** Lo que devuelve /revisar-mes: una revision por cada OP marcada. */
export interface RevisionMesConcar {
  anio: string;
  mes: string;
  /** El numero del documento VR que va a llevar la contrapartida. */
  numDocumento: string;
  ordenes: number;
  lineas: number;
  /** Todo o nada: false si una sola orden tiene errores. */
  puedeExportar: boolean;
  porOrden: RevisionConcar[];
}
