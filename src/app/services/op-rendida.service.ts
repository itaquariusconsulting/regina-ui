import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { FiltroOpRendida, OpRendida } from '../models/op-rendida';

/**
 * Las OP rendidas pendientes de liquidación.
 *
 * Solo lectura: esta pantalla no cambia nada, muestra lo que contabilidad
 * tiene listo para trabajar.
 */
@Injectable({
  providedIn: 'root'
})
export class OpRendidaService {

  private apiUrlProcess: string = environment.apiUrlProcess;

  constructor(private http: HttpClient) { }

  buscar(codEmpresa: string, codSucursal: string, filtro: FiltroOpRendida): Observable<OpRendida[]> {

    let params = new HttpParams()
      .set('codEmpresa', codEmpresa)
      .set('codSucursal', codSucursal);

    // Los vacíos no se mandan: el backend los interpretaría como "filtrar por
    // vacío" en vez de "no filtrar".
    params = this.agregarSiTiene(params, 'numOrden', filtro.numOrden);
    params = this.agregarSiTiene(params, 'persona', filtro.persona);
    params = this.agregarSiTiene(params, 'anio', filtro.anio);
    params = this.agregarSiTiene(params, 'mes', filtro.mes);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${sessionStorage.getItem('authToken') ?? ''}`,
      'Content-Type': 'application/json'
    });

    return this.http.get<OpRendida[]>(`${this.apiUrlProcess}rendicion/rendidas`, {
      headers,
      params,
      responseType: 'json'
    });
  }

  private agregarSiTiene(params: HttpParams, nombre: string, valor?: string): HttpParams {
    const limpio = (valor ?? '').trim();
    return limpio ? params.set(nombre, limpio) : params;
  }
}
