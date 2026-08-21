import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Response } from '../models/response';
import {
  EliminarComprobanteRequest,
  PreCerrarRequest,
  PublicacionResultadoDTO,
  RendicionCabDTO,
  RendicionDetDTO
} from '../models/rendicion';

/**
 * La antesala de la rendicion.
 *
 * Todo lo que pasa por aca se guarda en REGINA, no en contabilidad. El unico
 * metodo que escribe en el ERP es {@link preCerrar}, y es de ida: despues de
 * llamarlo la rendicion queda cerrada y el resto de los metodos responden 409.
 *
 * Sobre el 409: no es una falla del sistema, es "esa operacion no
 * corresponde" —la rendicion ya se cerro, el comprobante ya no esta, esta
 * duplicado—. El backend manda en `mensaje` un texto escrito para mostrarle
 * al usuario tal cual, asi que conviene usarlo en vez de inventar uno.
 */
@Injectable({
  providedIn: 'root'
})
export class RendicionService {

  private apiUrlProcess: string = environment.apiUrlProcess;

  constructor(private http: HttpClient) { }

  /**
   * Las cabeceras de cada llamada.
   *
   * El token se lee en cada pedido y no una sola vez al construir el
   * servicio: si el usuario renueva la sesion, un token cacheado al arranque
   * seguiria mandando el viejo y todo respondería 401.
   */
  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${sessionStorage.getItem('authToken') ?? ''}`,
      'Content-Type': 'application/json'
    });
  }

  /**
   * La rendicion completa: estado, comprobantes e impuestos.
   *
   * Si la orden todavia no tiene nada cargado devuelve una ABIERTA vacia. La
   * vista no necesita distinguir "no existe" de "existe y esta vacia".
   */
  obtener(codEmpresa: string, codSucursal: string, numOrden: string): Observable<RendicionCabDTO> {
    return this.http.get<RendicionCabDTO>(
      `${this.apiUrlProcess}rendicion/${codEmpresa}/${codSucursal}/${numOrden}`,
      { headers: this.headers(), responseType: 'json' }
    );
  }

  /**
   * Agrega un comprobante. Si es el primero de la orden, abre la rendicion.
   *
   * Devuelve el comprobante con el `idRendDet` que le asigno REGINA: hace
   * falta para poder editarlo o eliminarlo despues, y para nombrar el archivo
   * escaneado.
   */
  agregar(dto: RendicionDetDTO, userId?: number): Observable<RendicionDetDTO> {
    return this.http.post<RendicionDetDTO>(
      `${this.apiUrlProcess}rendicion/comprobante${this.queryUsuario(userId)}`,
      dto,
      { headers: this.headers(), responseType: 'json' }
    );
  }

  /** Corrige un comprobante ya cargado. Solo con la rendicion abierta. */
  actualizar(idRendDet: number, dto: RendicionDetDTO, userId?: number): Observable<RendicionDetDTO> {
    return this.http.put<RendicionDetDTO>(
      `${this.apiUrlProcess}rendicion/comprobante/${idRendDet}${this.queryUsuario(userId)}`,
      dto,
      { headers: this.headers(), responseType: 'json' }
    );
  }

  /**
   * Elimina un comprobante que se subio por error.
   *
   * Va como POST y no como DELETE porque lleva cuerpo —el motivo y quien
   * elimina—, y el DELETE con body no se comporta igual en todos los proxies.
   */
  eliminar(idRendDet: number, req: EliminarComprobanteRequest): Observable<Response> {
    return this.http.post<Response>(
      `${this.apiUrlProcess}rendicion/comprobante/${idRendDet}/eliminar`,
      req,
      { headers: this.headers(), responseType: 'json' }
    );
  }

  /**
   * Pre-cierra la rendicion y la manda a contabilidad.
   *
   * Es irreversible: hay que confirmarlo con el usuario ANTES de llamar aca.
   * Si algo falla al publicar, la rendicion queda abierta tal cual estaba y
   * en contabilidad no se escribio nada — no existe el "medio publicada".
   */
  preCerrar(req: PreCerrarRequest): Observable<PublicacionResultadoDTO> {
    return this.http.post<PublicacionResultadoDTO>(
      `${this.apiUrlProcess}rendicion/pre-cerrar`,
      req,
      { headers: this.headers(), responseType: 'json' }
    );
  }

  private queryUsuario(userId?: number): string {
    return userId != null ? `?userId=${userId}` : '';
  }
}
