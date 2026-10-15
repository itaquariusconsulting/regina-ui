import { OrdenPagoPropia } from './orden-pago-propia';

/** Un reparo del validador. Mismo formato que usa la exportación a CONCAR. */
export interface ObservacionImportacion {
  nivel: 'ERROR' | 'AVISO';
  /** Fila del Excel tal como la numera Excel. 0 si es del archivo entero. */
  fila: number;
  columna?: string;
  mensaje: string;
  origen?: string;
}

/** Una fila del archivo, con lo que decía y lo que el sistema entendió. */
export interface FilaImportada {
  fila: number;

  crudoNumOrden?: string;
  crudoFecha?: string;
  crudoPersona?: string;
  crudoNombre?: string;
  crudoGlosa?: string;
  crudoMoneda?: string;
  crudoImporte?: string;
  crudoCentroCosto?: string;
  crudoTipoGasto?: string;
  crudoPeriodo?: string;

  /** Lo interpretado. Es lo que se va a grabar. */
  op?: OrdenPagoPropia;

  /** Si el número vino del archivo o lo pone el sistema. */
  numeroDelArchivo?: boolean;

  conError?: boolean;
  vacia?: boolean;
}

/** Lo que devuelven tanto revisar como confirmar. */
export interface ResultadoImportacion {
  modoLectura?: string;
  filasLeidas: number;
  filasValidas: number;
  filasConError: number;
  filasVacias: number;
  grabado: boolean;
  creadas: string[];
  observaciones: ObservacionImportacion[];
  filas: FilaImportada[];
  hayErrores?: boolean;
}
