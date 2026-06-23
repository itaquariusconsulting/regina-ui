import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import { RucAnexosResponse } from '../models/establecimiento-anexo';

/**
 * Cliente Angular para el endpoint `/api/sunat/anexos/{ruc}` de
 * Regina-API-Process. Mantiene una caché en memoria por RUC para evitar
 * llamadas repetidas durante la misma sesión de rendición.
 */
@Injectable({ providedIn: 'root' })
export class SunatAnexosService {

  /** Caché en memoria: rucCache[ruc] = RucAnexosResponse */
  private rucCache = new Map<string, RucAnexosResponse>();

  /** Base URL del backend Regina-API-Process. */
  private get baseUrl(): string {
    // apiUrlProcess termina en "/api/" así que cortamos el "/api/"
    // para reconstruir "/api/sunat/anexos/{ruc}".
    const base = (environment as any).apiUrlProcess as string;
    return base.endsWith('/api/') ? base.slice(0, -5) : base;
  }

  constructor(private http: HttpClient) {}

  /**
   * Consulta los anexos de un RUC. Devuelve siempre un observable.
   * Si el RUC ya fue consultado en esta sesión, devuelve el resultado cacheado.
   */
  consultarAnexos(ruc: string, opts: { skipCache?: boolean } = {}): Observable<RucAnexosResponse> {
    if (!ruc || !/^\d{11}$/.test(ruc)) {
      return throwError(() => new Error('RUC inválido'));
    }

    if (!opts.skipCache && this.rucCache.has(ruc)) {
      const cached = this.rucCache.get(ruc)!;
      return of({ ...cached, desdeCache: true });
    }

    const url = `${this.baseUrl}/api/sunat/anexos/${ruc}`;
    // El scraping con Playwright + paginación puede tardar 20-40s en RUCs
    // grandes (Plaza Vea = 137 anexos). Damos un margen razonable de 60s.
    // X-Skip-Error-Handler evita que el AuthInterceptor lance Swal genéricos
    // — esta capa los maneja con sus propios mensajes específicos.
    const headers = new HttpHeaders({ 'X-Skip-Error-Handler': 'true' });
    const t0 = Date.now();
    console.log(`[SunatAnexosService] GET ${url}`);

    return this.http.get<Response>(url, { headers }).pipe(
      timeout(60_000),
      map((res: Response) => {
        const ms = Date.now() - t0;
        console.log(`[SunatAnexosService] respuesta en ${ms}ms`, res);
        if (res?.error !== 0) {
          throw new Error(res?.mensaje || 'Error consultando SUNAT');
        }
        return res.resultado as RucAnexosResponse;
      }),
      tap(data => this.rucCache.set(ruc, data)),
      catchError(err => {
        const ms = Date.now() - t0;
        console.error(`[SunatAnexosService] ERROR tras ${ms}ms:`, err);
        return throwError(() => err);
      })
    );
  }

  /** Invalida el cache local de un RUC específico. */
  invalidarCache(ruc?: string): void {
    if (ruc) {
      this.rucCache.delete(ruc);
    } else {
      this.rucCache.clear();
    }
  }

  /** Devuelve los anexos cacheados de un RUC, si existen. */
  obtenerCacheado(ruc: string): RucAnexosResponse | undefined {
    return this.rucCache.get(ruc);
  }
}
