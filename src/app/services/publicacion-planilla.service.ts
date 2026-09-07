import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { OrdenPagoCabPlanilla } from '../models/orden-pago-planilla-movilidad-cab';

/**
 * El envio de una planilla de movilidad a contabilidad.
 *
 * Es la unica llamada del front que escribe asientos en el ERP, asi que va
 * sola en su servicio en vez de mezclada con el CRUD de planillas: quien lea
 * esto despues tiene que ver de un vistazo cual es la que no se deshace.
 */
@Injectable({ providedIn: 'root' })
export class PublicacionPlanillaService {

  private readonly base = `${environment.apiUrlProcess}rendicion/planilla`;

  constructor(private http: HttpClient) {}

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  /** Si el envio esta habilitado en el servidor, y con que concepto saldria. */
  estado(): Observable<Response> {
    return this.http.get<Response>(`${this.base}/publicacion/estado`, { headers: this.headers });
  }

  /**
   * Envia los viajes de una planilla cerrada.
   *
   * No es idempotente: cada llamada que prospera escribe asientos. El servidor
   * toma la planilla con un candado antes de escribir, asi que un segundo
   * intento se rechaza con 409 en vez de duplicarla — pero no conviene
   * apoyarse en eso: el boton se bloquea mientras la llamada esta en curso.
   */
  publicar(p: OrdenPagoCabPlanilla, tipoGasto?: string): Observable<Response> {
    return this.http.post<Response>(`${this.base}/publicar`, {
      codEmpresa:  p.codEmpresa,
      codSucursal: p.codSucursal,
      anioPeriodo: p.anioPeriodo,
      codPeriodo:  p.codPeriodo,
      numOrden:    p.numOrden,
      codPlanilla: p.codPlanilla,
      tipoGasto:   tipoGasto || ''
    }, { headers: this.headers });
  }
}
