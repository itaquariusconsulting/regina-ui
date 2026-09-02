import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { PlanillasDeMovilidad } from '../models/planilla-movilidad-reporte';

/**
 * El reporte de planillas de movilidad.
 *
 * Solo lee. Las planillas viven en el ERP y aca no se escribe nada.
 *
 * Quien ve que NO se decide en el cliente: el backend saca el usuario del
 * token y de la base su USER_ADMIN y su COD_AUXILIAR. El codAuxiliar que se
 * mande solo lo respeta si el que pregunta es admin; a un usuario comun se le
 * ignora y se le devuelven sus propias planillas.
 */
@Injectable({ providedIn: 'root' })
export class PlanillaMovilidadReporteService {

  /** apiUrlProcess ya termina en /api/ */
  private readonly base = `${environment.apiUrlProcess}rendicion/movilidad`;

  constructor(private http: HttpClient) {}

  /**
   * Con esta cabecera el interceptor no levanta su modal generico.
   *
   * La pantalla ya muestra su propio aviso, que dice que fallo el REPORTE y
   * que se puede reintentar. El modal decia "Recurso no encontrado / El
   * recurso solicitado no existe": cierto para el interceptor, inutil para
   * quien solo queria ver sus planillas.
   */
  private get sinModal(): HttpHeaders {
    return new HttpHeaders({ 'X-Skip-Error-Handler': 'true' });
  }

  buscar(codEmpresa: string, codSucursal: string,
         desde: string, hasta: string,
         codAuxiliar?: string): Observable<PlanillasDeMovilidad> {

    let params = new HttpParams()
      .set('codEmpresa', codEmpresa)
      .set('codSucursal', codSucursal);

    // Vacios no se mandan: el backend los trata como "sin filtro", y mandar
    // la cadena vacia lo obligaria a distinguir entre ausente y vacio.
    if (desde) { params = params.set('desde', desde); }
    if (hasta) { params = params.set('hasta', hasta); }
    if (codAuxiliar) { params = params.set('codAuxiliar', codAuxiliar); }

    return this.http.get<Response>(this.base, { params, headers: this.sinModal }).pipe(
      map(r => (r?.resultado as PlanillasDeMovilidad)
            ?? { planillas: [], cuantas: 0, viajes: 0, gastado: 0, admin: false })
    );
  }
}
