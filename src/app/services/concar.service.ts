import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { RevisionConcar } from '../models/concar';

/**
 * La exportacion de asientos al formato de importacion de CONCAR.
 *
 * Dos llamadas y la diferencia importa: `revisar` no consume numeracion y se
 * puede llamar las veces que haga falta; `exportar` reserva el numero de
 * comprobante, asi que se llama una sola vez y solo si la revision paso.
 */
@Injectable({ providedIn: 'root' })
export class ConcarService {

  /** apiUrlProcess ya termina en /api/ */
  private readonly base = `${environment.apiUrlProcess}rendicion/concar`;

  constructor(private http: HttpClient) {}

  /** Arma el asiento y lo valida. No genera archivo. */
  revisar(codEmpresa: string, codSucursal: string, anioPeriodo: string,
          codPeriodo: string, numOrden: string): Observable<Response> {
    return this.http.get<Response>(`${this.base}/revisar`, {
      params: this.llave(codEmpresa, codSucursal, anioPeriodo, codPeriodo, numOrden)
    });
  }

  /**
   * Descarga el xlsx.
   *
   * Se pide la respuesta completa, no solo el cuerpo, porque el nombre del
   * archivo viene en la cabecera Content-Disposition y hace falta para que la
   * descarga no se llame "download".
   *
   * Cuando el asiento tiene observaciones el servidor responde 422 con la lista
   * en el cuerpo. Eso llega como error de HttpClient aunque no sea una falla:
   * quien lo consuma debe leer `err.error` y mostrar las observaciones, no un
   * mensaje de error generico.
   */
  exportar(codEmpresa: string, codSucursal: string, anioPeriodo: string,
           codPeriodo: string, numOrden: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/exportar`, {
      params: this.llave(codEmpresa, codSucursal, anioPeriodo, codPeriodo, numOrden),
      responseType: 'blob',
      observe: 'response'
    });
  }

  /**
   * Dispara la descarga en el navegador.
   *
   * El nombre sale de Content-Disposition. El backend expone esa cabecera a
   * proposito; si por alguna razon no llegara, se cae a un nombre armado con el
   * numero de orden en vez de dejar al usuario con un archivo sin nombre.
   */
  descargar(res: HttpResponse<Blob>, numOrden: string): void {
    const cuerpo = res.body;
    if (!cuerpo) { return; }

    const url = window.URL.createObjectURL(cuerpo);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.nombreDe(res) || `CONCAR_${numOrden}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * El cuerpo de un 422 llega como Blob porque la llamada pidio blob.
   *
   * Hay que leerlo como texto y parsearlo para poder mostrar las
   * observaciones. Si no es JSON —un 500 del servidor, un proxy en el medio—
   * se devuelve null y quien llama muestra su mensaje generico.
   */
  async leerError(err: unknown): Promise<Response | null> {
    const e = err as { error?: unknown };
    if (!(e?.error instanceof Blob)) { return null; }
    try {
      return JSON.parse(await e.error.text()) as Response;
    } catch {
      return null;
    }
  }

  private nombreDe(res: HttpResponse<Blob>): string | null {
    const cd = res.headers.get('Content-Disposition');
    if (!cd) { return null; }
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return m ? decodeURIComponent(m[1]) : null;
  }

  private llave(codEmpresa: string, codSucursal: string, anioPeriodo: string,
                codPeriodo: string, numOrden: string): HttpParams {
    return new HttpParams()
      .set('codEmpresa', codEmpresa)
      .set('codSucursal', codSucursal)
      .set('anioPeriodo', anioPeriodo)
      .set('codPeriodo', codPeriodo)
      .set('numOrden', numOrden);
  }
}
