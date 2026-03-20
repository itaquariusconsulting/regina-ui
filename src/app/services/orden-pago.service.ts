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

  getOrdenesPago(wrapper: WrapperRequestOrdenPago): Observable<Response> {
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlProcess}orden-pago/listar/${wrapper.codEmpresa}/${wrapper.codSucursal}/${wrapper.codAuxiliar}/${wrapper.isAdmin ? AccountType.ADMIN : AccountType.USER}`, {
      headers,
      responseType: 'json'
    });
  }
}
