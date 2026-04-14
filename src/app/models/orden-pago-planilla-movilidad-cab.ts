export class OrdenPagoCabPlanilla {
    codEmpresa?: string;
    codSucursal?: string;
    anioPeriodo?: string;
    codPeriodo?: string;
    numOrden?: string;
    codPlanilla?: string;
    codAuxiliarBanco?: string;
    codAuxiliarPersonal?: string;
    fechaPlanilla?: Date;
    fechaPlanillaClose?: Date;
    cCentroCostos?: string;
    monto?: number;
    total?: number;
    recibido?: number;
    devolucion?: number;
    maxNumViajes?: number;
    glosa?: string;
    statusPlanilla?: string;
}

export enum ViewMode {
  New = 1,
  Edit = 2
}