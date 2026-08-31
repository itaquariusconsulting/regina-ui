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
  /** El usuario que rindió. Es el filtro por persona que sí tiene datos. */
  userId: string = '';
  /** Centro de costos: áreas internas y proyectos por cliente. */
  codCCostos: string = '';
  /** ABIERTA | RENDIDA | RECHAZADA. Vacío = todos. */
  estado: string = '';
}

/** Cuántas rendiciones recibió contabilidad y con cuánto adentro. */
export interface ResumenRendiciones {
  /** Todo lo que ya salió del usuario: en proceso + recepcionadas + observadas + liquidadas. */
  recibidas: number;

  /** Los cinco estados del recorrido, por separado. */
  pendientes: number;
  enProceso: number;
  recepcionadas: number;
  observadas: number;
  liquidadas: number;

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

  /** Lo que se le entregó según el ERP, sumando las OP de sus rendiciones. */
  importeEntregado?: number;
  /** Qué parte de lo entregado todavía no rindió. */
  porcentajePendiente?: number;

  /** En qué anda cada una de sus rendiciones, por estado. */
  pendientes: number;
  enProceso: number;
  recepcionadas: number;
  observadas: number;
  liquidadas: number;
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

/**
 * El recorrido de la rendición, tramo por tramo.
 *
 * Los promedios vienen en null —no en cero— cuando todavía nadie recorrió
 * ese tramo. Cero significaría "instantáneo", que es lo contrario.
 */
export interface TiemposEtapa {
  rendiciones: number;
  conRecepcion: number;
  conProceso: number;
  conLiquidacion: number;

  diasEnvioARecepcion?: number;
  diasRecepcionAProceso?: number;
  diasProcesoALiquidacion?: number;

  /** Envío → liquidación: el número que se pidió. */
  diasEnvioALiquidacion?: number;
  /** Carga del primer comprobante → liquidación. */
  diasCargaALiquidacion?: number;

  desdeCuando?: string;
}

/** Una opción de combo, sacada de los datos que existen. */
export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
  /** Cuántas rendiciones o comprobantes tiene: ordena y da contexto. */
  cuantos: number;
  /** Para agrupar los centros: 'Areas internas' o 'Proyectos'. */
  grupo?: string;
}

/** Lo que se puede elegir en los filtros. */
export interface OpcionesFiltro {
  personas: OpcionFiltro[];
  centros: OpcionFiltro[];
}

/**
 * Cuánto lleva una orden de pago en cada etapa del recorrido.
 *
 * Una fila por OP, no por comprobante. Los tramos que todavía no terminaron
 * siguen corriendo hasta hoy: eso es lo que convierte la lista en algo sobre
 * lo que se puede actuar.
 */
export interface TiempoOrden {
  numOrden: string;
  anoPeriodo?: string;
  codPeriodo?: string;

  userId?: number;
  usuario: string;
  username?: string;
  codAuxiliar?: string;

  estProceso?: string;
  etiquetaProceso?: string;

  fecCreada?: string;
  fecEnviada?: string;
  fecRecepcionada?: string;
  fecLiquidada?: string;

  diasPendiente?: number;
  diasEnProceso?: number;
  diasEnRecepcion?: number;
  diasTotal?: number;

  enCurso: boolean;
  comprobantes: number;
  importeSoles: number;
}
