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

  /* ------------------------------------------------- carga masiva por Excel */

  /** La ruta de importación cuelga de la misma base. */
  private get baseImport(): string { return `${this.base}/importar`; }

  /**
   * Baja la plantilla de carga.
   *
   * Se pide como blob y no como JSON porque lo que vuelve es un xlsx. El
   * nombre del archivo lo pone acá el front y no se lee del Content-Disposition
   * para no depender de que el proxy exponga esa cabecera.
   */
  descargarPlantilla(): Observable<Blob> {
    return this.http.get(`${this.baseImport}/plantilla`, { responseType: 'blob' });
  }

  /** Lee el archivo y devuelve lo que pasaría. No graba nada. */
  importarRevisar(codEmpresa: string, codSucursal: string, archivo: File): Observable<Response> {
    return this.http.post<Response>(`${this.baseImport}/revisar`,
      this.cuerpo(archivo),
      { params: new HttpParams().set('codEmpresa', codEmpresa).set('codSucursal', codSucursal) });
  }

  /**
   * Graba las OP del archivo. Todo o nada.
   *
   * Se manda el archivo otra vez y no el resultado de la revisión: el que
   * decide qué se graba es el servidor leyendo el Excel, no el navegador
   * devolviendo lo que le dijeron antes.
   */
  importarConfirmar(codEmpresa: string, codSucursal: string, archivo: File,
                    userId?: number): Observable<Response> {
    let p = new HttpParams().set('codEmpresa', codEmpresa).set('codSucursal', codSucursal);
    if (userId) { p = p.set('userId', String(userId)); }
    return this.http.post<Response>(`${this.baseImport}/confirmar`, this.cuerpo(archivo), { params: p });
  }

  /**
   * El multipart.
   *
   * No se fija Content-Type a propósito: el navegador tiene que ponerlo él
   * para incluir el boundary. Fijarlo a mano es la forma más rápida de que el
   * backend reciba el cuerpo vacío.
   */
  private cuerpo(archivo: File): FormData {
    const fd = new FormData();
    fd.append('archivo', archivo, archivo.name);
    return fd;
  }

  /**
   * El detalle de un 422 de importación, que trae el resultado completo.
   */
  resultadoDe(err: unknown): unknown | null {
    const e = err as { status?: number; error?: Response };
    return e?.status === 422 ? (e.error?.resultado ?? null) : null;
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
