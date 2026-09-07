import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { Response } from '../models/response';
import { WrapperRequestPlanillaMovilidadCab } from '../models/wrappers/wrapper-request-planilla-movilidad-cab';
import { OrdenPagoCabPlanilla } from '../models/orden-pago-planilla-movilidad-cab';

@Injectable({
    providedIn: 'root'
})
export class OrdenPagoPlanillaMovilidadCabService {

    constructor(private http: HttpClient) { }

    token = sessionStorage.getItem('authToken');
    private apiUrlProcess: string = environment.apiUrlProcess;

    getPlanillaMovilidad(wrapper: WrapperRequestPlanillaMovilidadCab): Observable<Response> {
        return this.http.get<Response>
            (`${this.apiUrlProcess}orden-pago-planilla/listar/${wrapper.codEmpresa}/${wrapper.codSucursal}/${wrapper.anioPeriodo}/${wrapper.codPeriodo}/${wrapper.numOrden}`, {
                headers: this.getHeaders()
            });
    }

    savePlanillaMovilidad(dto: OrdenPagoCabPlanilla): Observable<Response> {
        return this.http.post<Response>(`${this.apiUrlProcess}orden-pago-planilla/insertar`, dto, {
            headers: this.getHeaders()

        });
    }

    updatePlanillaMovilidad(dto: OrdenPagoCabPlanilla): Observable<Response> {
        return this.http.patch<Response>(`${this.apiUrlProcess}orden-pago-planilla/actualizar`, dto, {
            headers: this.getHeaders()
        });
    }

    /**
     * Borra una planilla identificandola por su llave completa.
     *
     * Antes se mandaba solo el codigo de planilla, y como ese codigo es un
     * correlativo por orden —cada OP arranca en 0000000001—, el borrado
     * alcanzaba a las planillas homonimas de otras ordenes.
     *
     * Los segmentos van escapados: son datos, no partes fijas de la ruta.
     */
    deletePlanillaMovilidad(p: OrdenPagoCabPlanilla): Observable<Response> {
        const partes = [
            p.codEmpresa, p.codSucursal, p.anioPeriodo,
            p.codPeriodo, p.numOrden, p.codPlanilla
        ];

        if (partes.some(x => !x)) {
            return throwError(() => new Error(
                'La planilla no tiene la llave completa; no se puede eliminar.'));
        }

        const ruta = partes.map(x => encodeURIComponent(x!)).join('/');

        return this.http.delete<Response>(
            `${this.apiUrlProcess}orden-pago-planilla/eliminar/${ruta}`, {
            headers: this.getHeaders()
        });
    }

    private getHeaders(): HttpHeaders {
        return new HttpHeaders({
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        });
    }
}
