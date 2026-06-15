export class PadronRuc {
    ruc?: string;
    razonSocial?: string;
    // Nombre comercial registrado en SUNAT. Si está vacío en la respuesta,
    // se muestra la razonSocial como fallback en el campo "Proveedor".
    nombreComercial?: string;
    estado?: string;
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