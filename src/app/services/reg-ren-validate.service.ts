import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Response } from '../models/response';
import { environment } from '../../environments/environment';
import { WrapperRequestUsuario } from '../models/wrappers/wrapper-request-usuario';
import { RegSecUser } from '../models/reg-sec-user';
import { RegRenValidate } from '../models/reg-ren-validate';

@Injectable({
  providedIn: 'root'
})
export class RegRenValidateService {

  constructor(private http: HttpClient) { }


  token = sessionStorage.getItem('authToken');
  apiUrlProcess: string = environment.apiUrlAuth;

  getRegRenValidateRules(): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlProcess}/api/reg-ren-validate/listar-reglas`, {
      headers,
      responseType: 'json'
    });
  }

  saveRegRenValidateRule(regla: RegRenValidate): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.post<Response>(`${this.apiUrlProcess}/api/reg-ren-validate/insertar`, regla, {
      headers,
      responseType: 'json'
    });
  }
}
