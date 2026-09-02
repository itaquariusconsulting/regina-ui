export class PadronRuc {
    ruc?: string;
    razonSocial?: string;
    // Nombre comercial registrado en SUNAT. Si está vacío en la respuesta,
    // se muestra la razonSocial como fallback en el campo "Proveedor".
    nombreComercial?: string;
    estado?: string;

    /**
     * La direccion fiscal completa, tal como la publica SUNAT.
     *
     * El padron reducido la traia desarmada (tipoVia, nombreVia, numero...) y
     * habia que rearmarla; la ficha de e-consultaruc la da entera. Los campos
     * sueltos de abajo se conservan por si algo todavia responde al formato
     * viejo, pero este es el que se usa cuando viene.
     */
    direccion?: string;

    /** Cuando se leyo de SUNAT (ISO). Null si el origen no lo informa. */
    fecConsulta?: string;

    /** true si se acaba de consultar; false si viene del cache de REGINA. */
    enVivo?: boolean;

    /** Aviso listo para mostrar cuando el dato no es de ahora. */
    aviso?: string;
    condicion?: string;
    ubigeo?: string;
    tipoVia?: string;
    nombreVia?: string;
    codZona?: string;
    tipoZona?: string;
    numero?: string;
    interior?: string;
    lote?: string;
    departamento?: string;
    manzana?: string;
    kilometro?: string;
}