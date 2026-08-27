import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  FiltroReporte,
  RendicionPorUsuario,
  ResumenRendiciones,
  TiempoComprobante
} from '../models/reporte-rendicion';

/**
 * Los tres reportes de rendición. Solo lectura.
 *
 * Todo sale de REGINA; del ERP solo se leen los nombres de las personas, y
 * eso lo resuelve el backend.
 */
@Injectable({
  providedIn: 'root'
})
export class ReporteRendicionService {

  private apiUrlProcess: string = environment.apiUrlProcess;

  constructor(private http: HttpClient) { }

  resumen(codEmpresa: string, codSucursal: string, filtro: FiltroReporte): Observable<ResumenRendiciones> {
    return this.http.get<ResumenRendiciones>(
      `${this.apiUrlProcess}rendicion/reportes/resumen`,
      { headers: this.cabeceras(), params: this.parametros(codEmpresa, codSucursal, filtro) });
  }

  porUsuario(codEmpresa: string, codSucursal: string, filtro: FiltroReporte): Observable<RendicionPorUsuario[]> {
    return this.http.get<RendicionPorUsuario[]>(
      `${this.apiUrlProcess}rendicion/reportes/por-usuario`,
      { headers: this.cabeceras(), params: this.parametros(codEmpresa, codSucursal, filtro) });
  }

  tiempos(codEmpresa: string, codSucursal: string, filtro: FiltroReporte, tope = 1000): Observable<TiempoComprobante[]> {
    const params = this.parametros(codEmpresa, codSucursal, filtro).set('tope', String(tope));
    return this.http.get<TiempoComprobante[]>(
      `${this.apiUrlProcess}rendicion/reportes/tiempos`,
      { headers: this.cabeceras(), params });
  }

  private parametros(codEmpresa: string, codSucursal: string, filtro: FiltroReporte): HttpParams {
    let params = new HttpParams()
      .set('codEmpresa', codEmpresa)
      .set('codSucursal', codSucursal);

    // Los vacíos no se mandan: el backend los tomaría como "filtrar por
    // vacío" en vez de "no filtrar".
    params = this.agregarSiTiene(params, 'desde', filtro.desde);
    params = this.agregarSiTiene(params, 'hasta', filtro.hasta);
    params = this.agregarSiTiene(params, 'codAuxiliar', filtro.codAuxiliar);
    return params;
  }

  private agregarSiTiene(params: HttpParams, nombre: string, valor?: string): HttpParams {
    const limpio = (valor ?? '').trim();
    return limpio ? params.set(nombre, limpio) : params;
  }

  private cabeceras(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${sessionStorage.getItem('authToken') ?? ''}`,
      'Content-Type': 'application/json'
    });
  }
}
