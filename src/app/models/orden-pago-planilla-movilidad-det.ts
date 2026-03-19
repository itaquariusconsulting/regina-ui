export class OrdenPagoPlanillaMovilidadDet {
    codEmpresa?: string;
    codSucursal?: string;
    anioPeriodo?: string;
    codPeriodo?: string;
    numOrden?: string;
    codPlanilla?: string;
    numItem?: string;
    fechaTraslado?: Date;
    codDocumento?: string;
    numDocumento?: string;
    codAuxiliarProveedor?: string;
    codOrigen?: string;
    codDestino?: string;
    observaciones?: string;
    codMoneda?: string;
    impSoles?: number = 0.00;
    impDolares?: number = 0.00;
    tipCambio?: number = 0;
    nroOcupantes?: number = 0;
}