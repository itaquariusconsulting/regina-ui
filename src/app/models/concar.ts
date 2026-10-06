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
  numComprobante: string;
  lineas: number;
  totalDebe: number;
  totalHaber: number;
  puedeExportar: boolean;
  observaciones: ObservacionConcar[];
  detalle: LineaAsientoConcar[];
}
