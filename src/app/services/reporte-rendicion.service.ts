import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  FiltroReporte,
  ObservacionesResumen,
  OpcionesFiltro,
  RendicionPorCentroCosto,
  RendicionPorUsuario,
  ResumenRendiciones,
  TiempoComprobante,
  TiemposEtapa,
  UsoRegina
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

  /**
   * Lo que se puede elegir en los filtros.
   *
   * Se pide una vez al abrir la pantalla. Solo trae lo que aparece en los
   * datos: el maestro de centros tiene 3733 filas y en las rendiciones
   * aparecen cinco.
   */
  opciones(codEmpresa: string, codSucursal: string): Observable<OpcionesFiltro> {
    return this.http.get<OpcionesFiltro>(
      `${this.apiUrlProcess}rendicion/reportes/opciones`,
      { headers: this.cabeceras(),
        params: new HttpParams().set('codEmpresa', codEmpresa).set('codSucursal', codSucursal) });
  }

  etapas(codEmpresa: string, codSucursal: string, filtro: FiltroReporte): Observable<TiemposEtapa> {
    return this.http.get<TiemposEtapa>(
      `${this.apiUrlProcess}rendicion/reportes/etapas`,
      { headers: this.cabeceras(), params: this.parametros(codEmpresa, codSucursal, filtro) });
  }

  porCentroCosto(codEmpresa: string, codSucursal: string, filtro: FiltroReporte): Observable<RendicionPorCentroCosto[]> {
    return this.http.get<RendicionPorCentroCosto[]>(
      `${this.apiUrlProcess}rendicion/reportes/por-centro-costo`,
      { headers: this.cabeceras(), params: this.parametros(codEmpresa, codSucursal, filtro) });
  }

  observaciones(codEmpresa: string, codSucursal: string, filtro: FiltroReporte): Observable<ObservacionesResumen> {
    return this.http.get<ObservacionesResumen>(
      `${this.apiUrlProcess}rendicion/reportes/observaciones`,
      { headers: this.cabeceras(), params: this.parametros(codEmpresa, codSucursal, filtro) });
  }

  uso(codEmpresa: string, codSucursal: string, filtro: FiltroReporte): Observable<UsoRegina[]> {
    return this.http.get<UsoRegina[]>(
      `${this.apiUrlProcess}rendicion/reportes/uso`,
      { headers: this.cabeceras(), params: this.parametros(codEmpresa, codSucursal, filtro) });
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
    params = this.agregarSiTiene(params, 'userId', filtro.userId);
    params = this.agregarSiTiene(params, 'codCCostos', filtro.codCCostos);
    params = this.agregarSiTiene(params, 'estado', filtro.estado);
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
