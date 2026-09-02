import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { WrapperComprobanteSunat } from '../models/wrappers/WrapperComprobanteSunat';

@Injectable({
    providedIn: 'root'
})

export class SunatService {
    // Lee el token FRESCO en cada llamada. Antes se capturaba una sola vez al
    // crear el servicio (singleton): si se instanciaba antes del login SSO,
    // mandaba "Bearer null" y el utils respondía "falta el token".
    private get token(): string | null { return sessionStorage.getItem('authToken'); }
    /**
     * La ficha RUC ahora la sirve el API de REGINA, no SAIWEB-API-UTILS.
     *
     * Aquel devolvia una copia del padron reducido que se bajaba los viernes
     * por un @Scheduled hoy comentado, guardada en el directorio temporal de
     * Windows: llevaba sin actualizarse quien sabe cuanto, y por eso un RUC
     * inscrito hace un mes no figuraba. REGINA lee la ficha en vivo de
     * e-consultaruc y la cachea.
     */
    private apiUrlProcess: string = environment.apiUrlProcess;
    private apiUrlSunat: string = environment.apiUrlAuth; 
    constructor(private http: HttpClient) { }

    getDataRUC(buscarruc: string): Observable<Response> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'X-Skip-Error-Handler': 'true'
        });
        // apiUrlProcess ya termina en /api/
        return this.http.get<Response>(`${this.apiUrlProcess}sunat/ruc/${buscarruc}`, {
            headers,
            responseType: 'json'
        });
    }

    // getLogPadronSunat() se elimino: apuntaba a /api/utils/log-padron-sunat,
    // un endpoint que NO existe en SAIWEB-API-UTILS —lo busque en todos sus
    // controllers— y que ademas nadie llamaba. Era una llamada muerta a un
    // servicio que ya no usamos.

    validarComprobante(wrapper: WrapperComprobanteSunat): Observable<Response> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        });
        return this.http.post<Response>(`${this.apiUrlSunat}/api/sunat/validar-comprobante`, wrapper, {
            headers,
            responseType: 'json'
        });
    }
}