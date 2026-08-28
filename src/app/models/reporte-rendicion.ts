/**
 * Lo que devuelven los tres reportes de rendición.
 *
 * Espejo de los DTO del backend. No hay clases con constructor porque acá
 * nada se arma a mano: todo llega del servidor.
 */

/** Filtros comunes. Vacío significa "no filtrar por esto". */
export class FiltroReporte {
  desde: string = '';
  hasta: string = '';
  codAuxiliar: string = '';
  /** Centro de costos: es lo más cercano a "área" que existe en el ERP. */
  codCCostos: string = '';
  /** ABIERTA | RENDIDA | RECHAZADA. Vacío = todos. */
  estado: string = '';
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


/** Una fila del reporte por centro de costos. */
export interface RendicionPorCentroCosto {
  codCCostos: string;
  desCCostos: string;
  rendiciones: number;
  comprobantes: number;
  importeSoles: number;
  porcentaje: number;
}

/** Un motivo de observación y cuántas veces apareció. */
export interface MotivoConteo {
  codMotivo: string;
  desMotivo: string;
  veces: number;
  importe: number;
  porcentaje: number;
}

/** Cuántas rendiciones vienen con observaciones, y por qué. */
export interface ObservacionesResumen {
  rendicionesRevisadas: number;
  rendicionesConObservacion: number;
  porcentajeRendiciones: number;

  comprobantes: number;
  comprobantesObservados: number;
  porcentajeComprobantes: number;

  importeObservado: number;
  rendicionesRechazadas: number;

  motivos: MotivoConteo[];
}

/** Una persona y cuánto usa REGINA. Incluye a los que no lo usan. */
export interface UsoRegina {
  userId?: number;
  usuario: string;
  username?: string;
  email?: string;
  habilitado?: boolean;

  rendiciones: number;
  comprobantes: number;
  ultimaRendicion?: string;

  /** SIN_USO | BAJO | ACTIVO. */
  nivel: string;
}

/** Un motivo del catálogo, para el combo de observación. */
export interface Motivo {
  codMotivo: string;
  desMotivo: string;
  ambito: string;
  orden: number;
}
