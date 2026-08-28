import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Motivo } from '../models/reporte-rendicion';
import { RendicionCabDTO, RendicionDetDTO } from '../models/rendicion';

/**
 * Lo que contabilidad hace cuando recibe los comprobantes físicos y algo no
 * cuadra.
 *
 * Observar no deshace nada en contabilidad: el asiento ya está hecho y
 * sacarlo por atrás rompe el cuadre del mes. Deja registrado que ese
 * comprobante no sustenta, con un motivo, para que el descuento al personal
 * se haga a la vista.
 */
@Injectable({ providedIn: 'root' })
export class ObservacionService {

  private apiUrlProcess: string = environment.apiUrlProcess;

  constructor(private http: HttpClient) { }

  /** Motivos del catálogo. `ambito` = COMPROBANTE | RENDICION. */
  motivos(ambito: string): Observable<Motivo[]> {
    return this.http.get<Motivo[]>(
      `${this.apiUrlProcess}rendicion/observacion/motivos`,
      { headers: this.cabeceras(), params: new HttpParams().set('ambito', ambito) });
  }

  /** La rendición completa, para elegir qué comprobante observar. */
  rendicion(codEmpresa: string, codSucursal: string, numOrden: string): Observable<RendicionCabDTO> {
    return this.http.get<RendicionCabDTO>(
      `${this.apiUrlProcess}rendicion/${codEmpresa}/${codSucursal}/${numOrden}`,
      { headers: this.cabeceras() });
  }

  observarComprobante(idRendDet: number, cuerpo: {
    userId?: number; codMotivo?: string; motivo?: string; levantar?: boolean;
  }): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrlProcess}rendicion/observacion/comprobante/${idRendDet}`,
      cuerpo, { headers: this.cabeceras() });
  }

  rechazarRendicion(cuerpo: {
    codEmpresa: string; codSucursal: string; numOrden: string;
    userId?: number; codMotivo?: string; motivo?: string;
  }): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrlProcess}rendicion/observacion/rechazar`,
      cuerpo, { headers: this.cabeceras() });
  }

  private cabeceras(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${sessionStorage.getItem('authToken') ?? ''}`,
      'Content-Type': 'application/json'
    });
  }
}
