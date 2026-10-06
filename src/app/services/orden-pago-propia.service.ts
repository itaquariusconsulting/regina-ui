import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { FiltroOrdenPagoPropia, OrdenPagoPropia } from '../models/orden-pago-propia';

/**
 * El alta de órdenes de pago de RENDIX CONCAR.
 *
 * Solo existe en esta versión: en la de Aquarius las OP vienen del ERP.
 *
 * El servidor responde con tres códigos distintos y conviene distinguirlos al
 * consumirlo:
 *   422  faltan datos o no cumplen — `resultado` trae la lista de reparos
 *   409  la operación no corresponde en ese estado — `mensaje` lo explica
 *   500  algo se rompió de verdad
 */
@Injectable({ providedIn: 'root' })
export class OrdenPagoPropiaService {

  /** apiUrlProcess ya termina en /api/ */
  private readonly base = `${environment.apiUrlProcess}rendicion/op`;

  constructor(private http: HttpClient) {}

  listar(codEmpresa: string, codSucursal: string, f: FiltroOrdenPagoPropia): Observable<Response> {
    let p = new HttpParams()
      .set('codEmpresa', codEmpresa)
      .set('codSucursal', codSucursal);

    const agregar = (clave: string, valor?: string) => {
      if (valor && valor.trim()) { p = p.set(clave, valor.trim()); }
    };
    agregar('anio', f.anio);
    agregar('mes', f.mes);
    agregar('numOrden', f.numOrden);
    agregar('persona', f.persona);
    agregar('estado', f.estado);

    return this.http.get<Response>(this.base, { params: p });
  }

  obtener(codEmpresa: string, codSucursal: string, numOrden: string): Observable<Response> {
    return this.http.get<Response>(`${this.base}/${codEmpresa}/${codSucursal}/${numOrden}`);
  }

  /** El numOrden que vaya en el cuerpo se ignora: lo asigna el servidor. */
  crear(dto: OrdenPagoPropia, userId?: number): Observable<Response> {
    const p = userId ? new HttpParams().set('userId', String(userId)) : undefined;
    return this.http.post<Response>(this.base, dto, { params: p });
  }

  actualizar(dto: OrdenPagoPropia): Observable<Response> {
    return this.http.put<Response>(this.base, dto);
  }

  borrar(codEmpresa: string, codSucursal: string, numOrden: string): Observable<Response> {
    return this.http.delete<Response>(`${this.base}/${codEmpresa}/${codSucursal}/${numOrden}`);
  }

  /**
   * Los reparos de un 422, listos para mostrar.
   *
   * Devuelve vacío si el error no es de validación, para que quien llama
   * pueda caer a su mensaje genérico sin tener que mirar el código HTTP.
   */
  reparosDe(err: unknown): string[] {
    const e = err as { status?: number; error?: Response };
    if (e?.status !== 422) { return []; }
    const r = e.error?.resultado;
    return Array.isArray(r) ? r as string[] : [];
  }
}
