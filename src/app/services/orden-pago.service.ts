import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { WrapperRequestOrdenPago } from '../models/wrappers/wrapper-request-orden-pago';
import { Response } from '../models/response';
import { AccountType } from '../shared/constants/accounts';

@Injectable({
  providedIn: 'root'
})
export class OrdenPagoService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  private apiUrlProcess: string = environment.apiUrlProcess;

  /**
   * Marcador para el auxiliar cuando no hay ninguno.
   *
   * El administrador consulta todas las ordenes y por lo tanto no manda
   * auxiliar. Si ese valor viaja vacio, la URL queda con un segmento nulo
   * (`/listar/0001/001//A`) y Spring Security la rechaza ANTES de llegar al
   * controlador: StrictHttpFirewall trata el `//` como un intento de salto de
   * ruta y responde 500 sin que nuestro codigo se entere.
   *
   * El backend ignora este campo cuando isAdmin es verdadero, asi que mandar
   * un marcador no cambia el resultado: solo evita el segmento vacio.
   */
  private static readonly SIN_AUXILIAR = '-';

  getOrdenesPago(wrapper: WrapperRequestOrdenPago): Observable<Response> {

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });

    const tipo = wrapper.isAdmin ? AccountType.ADMIN : AccountType.USER;

    const url = `${this.apiUrlProcess}orden-pago/listar/`
      + `${OrdenPagoService.segmento(wrapper.codEmpresa)}/`
      + `${OrdenPagoService.segmento(wrapper.codSucursal)}/`
      + `${OrdenPagoService.segmento(wrapper.codAuxiliar)}/`
      + `${OrdenPagoService.segmento(tipo)}`;

    return this.http.get<Response>(url, {
      headers,
      responseType: 'json'
    });
  }

  /**
   * Un tramo de la URL que nunca queda vacio.
   *
   * Cualquiera de los cuatro puede llegar sin valor -el auxiliar del
   * administrador siempre, y empresa o sucursal si la sesion se abrio a medias-
   * y basta uno para que la peticion muera en el firewall.
   */
  private static segmento(valor?: string): string {
    const v = (valor ?? '').trim();
    return encodeURIComponent(v || OrdenPagoService.SIN_AUXILIAR);
  }
}
