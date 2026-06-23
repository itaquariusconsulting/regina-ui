/**
 * Modelo de un Establecimiento Anexo publicado por SUNAT.
 * Coincide con EstablecimientoAnexoDTO del backend Regina-API-Process.
 */
export interface EstablecimientoAnexo {
  codigo?: string;
  tipo?: string;
  direccion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  actividadEconomica?: string;
}

/**
 * Respuesta consolidada del endpoint /api/sunat/anexos/{ruc}.
 */
export interface RucAnexosResponse {
  ruc: string;
  razonSocial?: string;
  nombreComercial?: string;
  estadoContribuyente?: string;
  condicionDomicilio?: string;
  tipoContribuyente?: string;
  direccionFiscal?: string;
  ubigeo?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  anexos: EstablecimientoAnexo[];
  fechaConsulta?: string;
  desdeCache?: boolean;
}
