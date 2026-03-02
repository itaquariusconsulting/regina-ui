import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Response } from '../models/response';

@Injectable({
    providedIn: 'root'
})

export class SunatService {
    token = sessionStorage.getItem('authToken');
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