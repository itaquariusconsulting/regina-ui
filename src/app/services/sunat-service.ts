import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Response } from '../models/response';

@Injectable({
    providedIn: 'root'
})

export class SunatService {
    // Lee el token FRESCO en cada llamada. Antes se capturaba una sola vez al
    // crear el servicio (singleton): si se instanciaba antes del login SSO,
    // mandaba "Bearer null" y el utils respondía "falta el token".
    private get token(): string | null { return sessionStorage.getItem('authToken'); }
    private apiUrlUtils: string = environment.apiUrlUtils;
    constructor(private http: HttpClient) { }

    getDataRUC(buscarruc: string): Observable<Response> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'X-Skip-Error-Handler': 'true'
        });
        return this.http.get<Response>(`${this.apiUrlUtils}ruc/${buscarruc}`, {
            headers,
            responseType: 'json'
        });
    }

    getLogPadronSunat(): Observable<Response> {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        });
        return this.http.get<Response>(`${this.apiUrlUtils}log-padron-sunat`, {
            headers,
            responseType: 'json'
        });
    }
}