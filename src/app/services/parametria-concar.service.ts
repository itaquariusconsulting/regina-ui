import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import {
  CuentaGasto, EquivalenciaConcar, ParametroConcar, TipoCambio
} from '../models/parametria-concar';

/**
 * La parametría del asiento de CONCAR y el tipo de cambio.
 *
 * Hasta ahora estos valores solo se tocaban corriendo un script SQL. Los
 * escribimos nosotros a partir de lo que entendimos, y más de uno estaba mal
 * sin que contabilidad tuviera forma de verlo.
 */
@Injectable({ providedIn: 'root' })
export class ParametriaConcarService {

  /** apiUrlProcess ya termina en /api/ */
  private readonly base = `${environment.apiUrlProcess}maestro/parametria`;
  private readonly baseTc = `${environment.apiUrlProcess}maestro/tipo-cambio`;

  constructor(private http: HttpClient) {}

  /* ------------------------------------------------------------ lecturas */

  parametros(codEmpresa: string): Observable<Response> {
    return this.http.get<Response>(`${this.base}/parametros`, { params: this.e(codEmpresa) });
  }

  cuentas(codEmpresa: string): Observable<Response> {
    return this.http.get<Response>(`${this.base}/cuentas`, { params: this.e(codEmpresa) });
  }

  equivalencias(codEmpresa: string): Observable<Response> {
    return this.http.get<Response>(`${this.base}/equivalencias`, { params: this.e(codEmpresa) });
  }

  /* ----------------------------------------------------------- escrituras */

  guardarParametro(p: ParametroConcar, userId?: number): Observable<Response> {
    return this.http.put<Response>(`${this.base}/parametros`, p, { params: this.u(userId) });
  }

  guardarCuenta(c: CuentaGasto, userId?: number): Observable<Response> {
    return this.http.put<Response>(`${this.base}/cuentas`, c, { params: this.u(userId) });
  }

  guardarEquivalencia(q: EquivalenciaConcar, userId?: number): Observable<Response> {
    return this.http.put<Response>(`${this.base}/equivalencias`, q, { params: this.u(userId) });
  }

  borrarCuenta(codEmpresa: string, codTipoGasto: string): Observable<Response> {
    return this.http.delete<Response>(`${this.base}/cuentas`,
      { params: this.e(codEmpresa).set('codTipoGasto', codTipoGasto) });
  }

  borrarEquivalencia(codEmpresa: string, tipo: string, valorErp: string): Observable<Response> {
    return this.http.delete<Response>(`${this.base}/equivalencias`,
      { params: this.e(codEmpresa).set('tipo', tipo).set('valorErp', valorErp) });
  }

  /* -------------------------------------------------------- tipo de cambio */

  tiposDeCambio(cuantos = 30): Observable<Response> {
    return this.http.get<Response>(this.baseTc,
      { params: new HttpParams().set('cuantos', String(cuantos)) });
  }

  /** Trae del servicio lo que falte de los últimos días. */
  actualizarTipoCambio(usuario?: string): Observable<Response> {
    let p = new HttpParams();
    if (usuario) { p = p.set('usuario', usuario); }
    return this.http.post<Response>(`${this.baseTc}/actualizar`, {}, { params: p });
  }

  /** Carga o corrige el de un día. Lo manual no lo pisa después el automático. */
  tipoCambioManual(tc: TipoCambio, usuario?: string): Observable<Response> {
    let p = new HttpParams();
    if (usuario) { p = p.set('usuario', usuario); }
    return this.http.post<Response>(`${this.baseTc}/manual`, tc, { params: p });
  }

  /* ---------------------------------------------------------- plomería */

  private e(codEmpresa: string): HttpParams {
    return new HttpParams().set('codEmpresa', codEmpresa);
  }

  private u(userId?: number): HttpParams {
    let p = new HttpParams();
    if (userId) { p = p.set('userId', String(userId)); }
    return p;
  }
}
