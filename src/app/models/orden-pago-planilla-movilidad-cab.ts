
export class OrdenPagoCabPlanilla {
    codEmpresa?: string;        // varchar(4)
    codSucursal?: string;       // varchar(3)
    anioPeriodo?: string;       // varchar(4)
    codPeriodo?: string;        // varchar(3)
    numOrden?: string;          // varchar(10)
    numItemOP?: string;
    numPlanilla?: string;       // varchar(10)

    fecCreatePlanilla?: string;  // LocalDate → string (yyyy-MM-dd)
    fecClosePlanilla?: string;   // LocalDate → string
    fecUpdatePlanilla?: string;  // LocalDate → string

    amountPlanilla?: number;     // BigDecimal → number
    statusPlanilla?: boolean;    // bit → boolean

}