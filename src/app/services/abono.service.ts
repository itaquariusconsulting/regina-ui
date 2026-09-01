import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { AbonoRendicion, AbonosDeOrden } from '../models/abono-rendicion';

/**
 * Vouchers de abono: la devolución del saldo de una orden de pago.
 *
 * Todo esto vive en la base de REGINA. El asiento lo hace contabilidad en el
 * ERP (Tesorería → Transacciones → Ingresos); acá solo se junta la evidencia
 * del depósito para que la tengan a la vista al registrarlo.
 */
@Injectable({ providedIn: 'root' })
export class AbonoService {

  /** apiUrlProcess ya termina en /api/ */
  private readonly base = `${environment.apiUrlProcess}rendicion/abono`;

  constructor(private http: HttpClient) {}

  listar(codEmpresa: string, codSucursal: string, numOrden: string): Observable<AbonosDeOrden> {
    const params = new HttpParams()
      .set('codEmpresa', codEmpresa)
      .set('codSucursal', codSucursal)
      .set('numOrden', numOrden);

    return this.http.get<Response>(this.base, { params }).pipe(
      // El backend responde el envoltorio Response; acá abajo solo interesa
      // el resultado, y si viene vacío se devuelve una lista y cero en vez de
      // undefined, para que la pantalla no tenga que defenderse.
      map(r => (r?.resultado as AbonosDeOrden) ?? { abonos: [], devuelto: 0 })
    );
  }

  /** Devuelve el abono ya con su id, que hace falta para adjuntarle el archivo. */
  crear(abono: AbonoRendicion, userId?: number): Observable<Response> {
    let params = new HttpParams();
    if (userId != null) { params = params.set('userId', String(userId)); }
    return this.http.post<Response>(this.base, abono, { params });
  }

  adjuntar(idRendAbono: number, archivoNombre: string, archivoRuta: string): Observable<Response> {
    const params = new HttpParams()
      .set('archivoNombre', archivoNombre || '')
      .set('archivoRuta', archivoRuta || '');
    return this.http.post<Response>(`${this.base}/${idRendAbono}/archivo`, null, { params });
  }

  anular(idRendAbono: number, userId?: number): Observable<Response> {
    let params = new HttpParams();
    if (userId != null) { params = params.set('userId', String(userId)); }
    return this.http.delete<Response>(`${this.base}/${idRendAbono}`, { params });
  }
}
