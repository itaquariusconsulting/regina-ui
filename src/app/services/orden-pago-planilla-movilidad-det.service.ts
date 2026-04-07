import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { OrdenPagoPlanillaMovilidadDet } from '../models/orden-pago-planilla-movilidad-det';

@Injectable({
  providedIn: 'root'
})
export class OrdenPagoPlanillaMovilidadDetService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  private apiUrlProcess: string = environment.apiUrlProcess;

  insertarDetalle(dto: OrdenPagoPlanillaMovilidadDet): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<Response>(`${this.apiUrlProcess}orden-pago-det-planilla/insertar`, dto, {
      headers,
      responseType: 'json'
    });
  }

  listarDetalle(
    codEmpresa: string,
    codSucursal: string,
    anioPeriodo: string,
    codPeriodo: string,
    numOrden: string,
    codPlanilla: string
  ): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });

    return this.http.get<Response>(
      `${this.apiUrlProcess}orden-pago-det-planilla/listar/${codEmpresa}/${codSucursal}/${anioPeriodo}/${codPeriodo}/${numOrden}/${codPlanilla}`,
      {
        headers,
        responseType: 'json'
      }
    );
  }
}
