import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Response } from '../models/response';

@Injectable({
  providedIn: 'root'
})
export class MaestrosService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  private apiUrlMaestros: string = environment.apiUrlMaestros;

  getListaAuxiliares(codEmpresa: string): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlMaestros}mae-auxiliar/listar/${codEmpresa}`, {
      headers,
      responseType: 'json'
    });
  }

  getRubros(codEmpresa: string): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlMaestros}mae-rubro/listar/${codEmpresa}`, {
      headers,
      responseType: 'json'
    });
  }

  getTiposGasto(codEmpresa: string, codRubro: string): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlMaestros}tipo-gasto/listar/${codEmpresa}/${codRubro}`, {
      headers,
      responseType: 'json'
    });
  }

  getTiposDocumento(codEmpresa: string): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlMaestros}documento/listar/${codEmpresa}`, {
      headers,
      responseType: 'json'
    });
  }

  getMonedas(): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlMaestros}moneda/listar`, {
      headers,
      responseType: 'json'
    });
  }

  getTiposCambio(): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlMaestros}tipo-cambio/listar`, {
      headers,
      responseType: 'json'
    });
  }

  getImpuestos(codEmpresa: string, codDocumento: string): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlMaestros}impuesto/listar/${codEmpresa}/${codDocumento}`, {
      headers,
      responseType: 'json'
    });
  }
}