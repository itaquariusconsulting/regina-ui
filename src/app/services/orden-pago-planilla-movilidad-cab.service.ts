import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { WrapperRequestOrdenPago } from '../models/wrappers/wrapper-request-orden-pago';
import { Response } from '../models/response';
import { WrapperRequestOrdenPagoDet } from '../models/wrappers/wrapper-request-orden-pago-det';
import { OrdenPagoDetDTO } from '../models/orden-pago-det';
import { WrapperRequestPlanillaMovilidadCab } from '../models/wrappers/wrapper-request-planilla-movilidad-cab';
import { OrdenPagoPlanillaMovilidadCab } from '../models/orden-pago-planilla-movilidad-cab';
@Injectable({
    providedIn: 'root'
})
export class OrdenPagoPlanillaMovilidadCabService {

    constructor(private http: HttpClient) { }

    token = sessionStorage.getItem('authToken');
    private apiUrlProcess: string = environment.apiUrlProcess;

    getPlanillaMovilidad(wrapper: WrapperRequestPlanillaMovilidadCab): Observable<Response> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        });
        return this.http.post<Response>(`${this.apiUrlProcess}planilla-movilidad-cab/listar`, wrapper, {
            headers,
            responseType: 'json'
        });
    }

    savePlanillaMovilidad(dto: OrdenPagoPlanillaMovilidadCab): Observable<Response> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        });
        return this.http.post<Response>(`${this.apiUrlProcess}planilla-movilidad-cab/insertar`, dto, {
            headers,
            responseType: 'json'
        });
    }
}
