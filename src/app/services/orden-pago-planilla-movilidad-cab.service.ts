import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
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

    deletePlanillaMovilidad(codPlanilla: string): Observable<Response> {
        return this.http.delete<Response>(`${this.apiUrlProcess}orden-pago-planilla/eliminar/${codPlanilla}`, {
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
