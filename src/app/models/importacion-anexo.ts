import { ObservacionImportacion } from './importacion-op';

/** Un anexo listo para grabar, tal como lo entendió el servidor. */
export interface AnexoImportado {
  codEmpresa?: string;
  codAuxiliar?: string;
  desAuxiliar?: string;
  tipDocIdentidad?: string;
  numDocIdentidad?: string;
  numRuc?: string;
  desDireccion?: string;
  numTelefono?: string;
  numEmail?: string;
  codTipoAuxi?: string;
  indBaja?: string;
}

/** Una fila del archivo, con lo que decía y lo que el sistema entendió. */
export interface FilaAnexo {
  fila: number;

  crudoCodigo?: string;
  crudoNombre?: string;
  crudoTipoDoc?: string;
  crudoNumDoc?: string;
  crudoRuc?: string;
  crudoTipoAnexo?: string;
  crudoDireccion?: string;
  crudoTelefono?: string;
  crudoEmail?: string;
  crudoBaja?: string;

  /** Lo interpretado. Es lo que se va a grabar. */
  auxiliar?: AnexoImportado;

  /** Si el anexo ya está en el maestro: la fila lo actualiza, no lo crea. */
  yaExiste?: boolean;

  conError?: boolean;
  vacia?: boolean;
}

/** Lo que devuelven tanto revisar como confirmar. */
export interface ResultadoAnexos {
  modoLectura?: string;
  filasLeidas: number;
  filasValidas: number;
  filasConError: number;
  filasVacias: number;
  grabado: boolean;
  creados: string[];
  actualizados: string[];
  observaciones: ObservacionImportacion[];
  filas: FilaAnexo[];
  hayErrores?: boolean;
}
