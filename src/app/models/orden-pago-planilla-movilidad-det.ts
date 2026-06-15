export class OrdenPagoPlanillaMovilidadDet {
    codEmpresa?: string;
    codSucursal?: string;
    anioPeriodo?: string;
    codPeriodo?: string;
    numOrden?: string;
    codPlanilla?: string;
    numItemPlanilla?: string;
    fecItemPlanilla?: Date;
    codDocumento?: string;
    numDocumento?: string;
    serDocumento?: string;
    codAuxiliarProveedor?: string;
    glosa?: string;
    importe?: number;
    ocupantes?: string;
    codOrigen?: string;
    codDestino?: string;
    // Direcciones físicas del trayecto (calle/avenida, número, referencia)
    dirOrigen?: string;
    dirDestino?: string;
}