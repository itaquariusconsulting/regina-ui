import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { OrdenPagoDetProv } from '../models/orden-pago-det-prov';

@Injectable({
  providedIn: 'root'
})
export class OrdenPagoDetProvService {

  constructor(private http: HttpClient) { }
  token = sessionStorage.getItem('authToken');
  private apiUrlProcess: string = environment.apiUrlProcess;

  saveOrdenPagoDetProv(listDTO: OrdenPagoDetProv[]): Observable<Response> {
    console.log("En el servicio : ", listDTO);
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.post<Response>(`${this.apiUrlProcess}orden-pago-det/insert`, listDTO, {
      headers,
      responseType: 'json'
    });
  }
}
