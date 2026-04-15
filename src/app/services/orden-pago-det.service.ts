import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { WrapperRequestOrdenPago } from '../models/wrappers/wrapper-request-orden-pago';
import { Response } from '../models/response';
import { WrapperRequestOrdenPagoDet } from '../models/wrappers/wrapper-request-orden-pago-det';
import { OrdenPagoDetDTO } from '../models/orden-pago-det';
import { WrapperRequestDocumebtoExistente } from '../models/wrappers/wrapper-request-documento-existente';
@Injectable({
  providedIn: 'root'
})
export class OrdenPagoDetService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  private apiUrlProcess: string = environment.apiUrlProcess;

  getOrdenesPagoDet(wrapper: WrapperRequestOrdenPagoDet): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlProcess}orden-pago-det/listar/${wrapper.codEmpresa}/${wrapper.codSucursal}/${wrapper.numOrden}`, {
      headers,
      responseType: 'json'
    });
  }

  saveOrdenPagoDet(dto: OrdenPagoDetDTO): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.post<Response>(`${this.apiUrlProcess}orden-pago-det/insert`, dto, {
      headers,
      responseType: 'json'
    });
  }

  saveOrdenPagoDetBatch(dtos: OrdenPagoDetDTO[]): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.post<Response>(`${this.apiUrlProcess}orden-pago-det/insert-batch`, dtos, {
      headers,
      responseType: 'json'
    });
  }

  onBuscarDocumento(wrapper: WrapperRequestDocumebtoExistente): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.post<Response>(`${this.apiUrlProcess}documentos/existente`, wrapper, {
      headers,
      responseType: 'json'
    });
  }

}
