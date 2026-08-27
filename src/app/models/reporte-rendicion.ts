/**
 * Lo que devuelven los tres reportes de rendición.
 *
 * Espejo de los DTO del backend. No hay clases con constructor porque acá
 * nada se arma a mano: todo llega del servidor.
 */

/** Filtros comunes a los tres. Vacío significa "no filtrar por esto". */
export class FiltroReporte {
  desde: string = '';
  hasta: string = '';
  codAuxiliar: string = '';
}

/** Cuántas rendiciones recibió contabilidad y con cuánto adentro. */
export interface ResumenRendiciones {
  recibidas: number;
  abiertas: number;
  rechazadas: number;

  comprobantes: number;
  importeSoles: number;
  importeDolares: number;

  usuarios: number;

  primerEnvio?: string;
  ultimoEnvio?: string;

  /** Desde cuándo la antesala guarda datos. Antes de esto no hay serie. */
  hayDatosDesde?: string;
}

/** Una fila del reporte por usuario. */
export interface RendicionPorUsuario {
  userId?: number;
  usuario: string;
  username?: string;

  rendiciones: number;
  comprobantes: number;
  importeSoles: number;

  primerEnvio?: string;
  ultimoEnvio?: string;

  comprobantesPorRendicion: number;
}

/** Un comprobante y cuánto esperó entre que se cargó y que salió. */
export interface TiempoComprobante {
  numOrden: string;
  idRendDet: number;
  comprobante: string;
  codDocumento?: string;
  numItemOp?: string;

  impSoles: number;

  fecCarga?: string;
  fecEnvio?: string;

  horasEspera?: number;
  diasEspera?: number;

  userIdCarga?: number;
  usuarioCarga?: string;
}
