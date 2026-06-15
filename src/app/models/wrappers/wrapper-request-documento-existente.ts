export class WrapperRequestDocumebtoExistente {
    codEmpresa?: string;
    codSucursal?: string;
    codAuxiliar?: string;
    codDocumento?: string;
    numDocumento?: string;
    numSerieDoc?: string;
    numOrden?: string;

    /**
     * RUC del proveedor/emisor. Si viene seteado, el backend resuelve
     * el codAuxiliar mediante JOIN con MAE_AUXILIAR. Útil cuando se
     * valida un documento recién escaneado y aún no se ha asociado
     * un auxiliar local.
     */
    numRuc?: string;
}