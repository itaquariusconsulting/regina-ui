import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { FiltroCruce, OpCruce } from '../models/op-cruce';

/**
 * El cruce entre las órdenes de pago del ERP y las rendiciones de REGINA.
 */
@Injectable({ providedIn: 'root' })
export class CruceService {

  /** apiUrlProcess ya termina en /api/ */
  private readonly base = `${environment.apiUrlProcess}rendicion/cruce`;

  constructor(private http: HttpClient) {}

  buscar(codEmpresa: string, codSucursal: string, filtro: FiltroCruce): Observable<OpCruce[]> {
    return this.http.get<OpCruce[]>(this.base, {
      params: this.armar(codEmpresa, codSucursal, filtro)
    });
  }

  /**
   * El Excel se pide como blob y lo arma el servidor.
   *
   * Con formato —encabezado fijo, anchos, números como números— no se puede
   * generar en el navegador sin sumar una librería, y en el backend ya estaba
   * POI.
   */
  excel(codEmpresa: string, codSucursal: string, filtro: FiltroCruce,
        usuario: string): Observable<Blob> {
    let p = this.armar(codEmpresa, codSucursal, filtro);
    if (usuario) { p = p.set('usuario', usuario); }
    return this.http.get(`${this.base}/excel`, { params: p, responseType: 'blob' });
  }

  private armar(codEmpresa: string, codSucursal: string, f: FiltroCruce): HttpParams {
    let p = new HttpParams()
      .set('codEmpresa', codEmpresa)
      .set('codSucursal', codSucursal);

    const agregar = (clave: string, valor?: string) => {
      if (valor && valor.trim()) { p = p.set(clave, valor.trim()); }
    };

    agregar('numOrden', f.numOrden);
    agregar('persona', f.persona);
    agregar('desde', f.desde);
    agregar('hasta', f.hasta);
    agregar('codCCostos', f.codCCostos);
    agregar('tipEstado', f.tipEstado);
    agregar('situacion', f.situacion);
    agregar('estProceso', f.estProceso);

    return p;
  }
}
