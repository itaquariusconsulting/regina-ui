export class MaeImpuesto {
    codEmpresa?: string;
    codImpuesto?: string;
    numVerPlanCuentas?: string;
    codCuenta?: string;

    desImpuesto?: string;
    tipImpuesto?: string;
    desAbreviatura?: string;

    numPorcentaje?: number;

    indProvision?: string;
    indTesoreriaIngreso?: string;
    indTesoreriaPago?: string;

    impTope?: number;

    codCuentaIgvSoles?: string;
    codCuentaIgvDolares?: string;

    fecInicio?: Date;
    fecFin?: Date;
}