import { OrdenPagoDetDTO } from './orden-pago-det';

/**
 * La antesala de la rendicion.
 *
 * Es el paso que se agrego entre el usuario y contabilidad: los comprobantes
 * ya no caen directo en la base del ERP. Se quedan en REGINA mientras el
 * usuario los arma —donde puede corregirlos y borrar los que subio por
 * error— y viajan a contabilidad recien cuando pre-cierra.
 *
 *   ABIERTA   los comprobantes viven solo en REGINA.
 *             se agrega, se corrige y se elimina.
 *
 *      | aprobar el envio  (irreversible)
 *      v
 *
 *   RENDIDA   los comprobantes ya estan en contabilidad.
 *             no se edita, no se elimina, no se reabre.
 *
 * Se llama RENDIDA y no CERRADA porque es la palabra que usa contabilidad, y
 * su pantalla de pendientes de liquidacion filtra justamente por esto.
 */
export type EstadoRendicion = 'ABIERTA' | 'RENDIDA';

/** Impuesto de un comprobante de la antesala. */
export class RendicionImpuestoDTO {
  idRendImpuesto?: number;
  idRendDet?: number;

  numCorrelativo?: string;
  numLiquidacion?: string;
  numItem?: string;
  anoProceso?: string;
  mesProceso?: string;
  numProvision?: string;
  codImpuesto?: string;
  codDocumento?: string;

  impImpuestoBase?: number;
  impImpuestoSecun?: number;

  indAfecto?: string;
  codSucLiq?: string;
  codSucProv?: string;
  numLte?: number;
}

/**
 * Un comprobante mientras vive en REGINA.
 *
 * Hereda todos los campos que el ERP espera —son los mismos que se copian al
 * publicar— y agrega lo que es propio de REGINA: el archivo escaneado, lo que
 * leyo el OCR, lo que respondio SUNAT y la auditoria.
 *
 * `numItemOp` viene vacio mientras la rendicion esta abierta: ese numero lo
 * asigna el ERP al publicar. La identidad de este lado es `idRendDet`, y es
 * la que hay que usar para editar o eliminar.
 */
export class RendicionDetDTO extends OrdenPagoDetDTO {
  idRendDet?: number;

  archivoNombre?: string;
  archivoRuta?: string;

  rucEmisor?: string;
  razonSocialEmisor?: string;
  igvTasa?: number;
  /** 'S' | 'N' */
  indValidadoSunat?: string;
  /** estadoCp de SUNAT: 0..4 */
  estSunat?: string;
  fecValidaSunat?: string;
  /** 'S' | 'N' */
  indIngresoManual?: string;

  userIdCrea?: number;
  fecCrea?: string;
  userIdModif?: number;
  fecModif?: string;

  impuestos?: RendicionImpuestoDTO[] = [];
}

/** La rendicion completa: estado + comprobantes. */
export class RendicionCabDTO {
  codEmpresa?: string;
  codSucursal?: string;
  numOrden?: string;

  estado?: EstadoRendicion;

  userIdCrea?: number;
  fecCrea?: string;
  userIdCierra?: number;
  fecCierra?: string;
  numItemsPublicados?: number;
  observacion?: string;

  detalle?: RendicionDetDTO[] = [];
}

/** Lo que se manda al eliminar un comprobante subido por error. */
export class EliminarComprobanteRequest {
  userId?: number;
  motivo?: string;
  borrarArchivo?: boolean = true;
}

/** Lo que se manda al pre-cerrar. */
export class PreCerrarRequest {
  codEmpresa?: string;
  codSucursal?: string;
  numOrden?: string;
  userId?: number;
  observacion?: string;
  exigirValidacionSunat?: boolean = false;
}

/** Como le fue al pre-cierre. */
export class PublicacionResultadoDTO {
  ok?: boolean;
  mensaje?: string;

  codEmpresa?: string;
  codSucursal?: string;
  numOrden?: string;

  itemsPublicados?: number;
  impuestosPublicados?: number;

  /** NUM_ITEM_OP que asigno el ERP a cada comprobante. */
  itemsOp?: string[] = [];
  /** Lo que hay que saber aunque no haya impedido publicar. */
  advertencias?: string[] = [];
}
