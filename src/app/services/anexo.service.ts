import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Response } from '../models/response';

/**
 * El maestro de anexos (MAE_AUXILIAR).
 *
 * <p>Por ahora solo la carga masiva. La pantalla de mantenimiento uno por uno
 * va a colgar de acá mismo cuando exista.
 */
@Injectable({ providedIn: 'root' })
export class AnexoService {

  /** apiUrlProcess ya termina en /api/ */
  private readonly base = `${environment.apiUrlProcess}maestro/auxiliar/importar`;

  constructor(private http: HttpClient) {}

  /**
   * Baja la plantilla de carga.
   *
   * Se pide como blob porque lo que vuelve es un xlsx. El nombre lo pone acá
   * el front y no se lee del Content-Disposition, para no depender de que el
   * proxy exponga esa cabecera.
   */
  descargarPlantilla(): Observable<Blob> {
    return this.http.get(`${this.base}/plantilla`, { responseType: 'blob' });
  }

  /** Lee el archivo y devuelve lo que pasaría. No graba nada. */
  revisar(codEmpresa: string, archivo: File): Observable<Response> {
    return this.http.post<Response>(`${this.base}/revisar`, this.cuerpo(archivo),
      { params: new HttpParams().set('codEmpresa', codEmpresa) });
  }

  /**
   * Graba los anexos del archivo. Todo o nada.
   *
   * Se manda el archivo otra vez y no el resultado de la revisión: el que
   * decide qué se graba es el servidor leyendo el archivo, no el navegador
   * devolviendo lo que le dijeron antes.
   */
  confirmar(codEmpresa: string, archivo: File, usuario?: string): Observable<Response> {
    let p = new HttpParams().set('codEmpresa', codEmpresa);
    if (usuario) { p = p.set('usuario', usuario); }
    return this.http.post<Response>(`${this.base}/confirmar`, this.cuerpo(archivo), { params: p });
  }

  /**
   * El detalle que viaja dentro de un error 422.
   *
   * El servidor manda la tabla de observaciones en el cuerpo del rechazo; sin
   * esto la pantalla solo podría decir "falló" y el usuario no sabría qué fila
   * corregir.
   */
  resultadoDe(err: unknown): unknown {
    const e = err as { error?: Response };
    return e?.error?.resultado ?? null;
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
}
