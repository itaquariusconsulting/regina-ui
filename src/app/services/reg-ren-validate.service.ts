import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Response } from '../models/response';
import { environment } from '../../environments/environment';
import { RegRenValidate } from '../models/reg-ren-validate';

@Injectable({
  providedIn: 'root'
})
export class RegRenValidateService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  apiUrlProcess: string = environment.apiUrlAuth;

  getRegRenValidateRules(): Observable<Response> {
    return this.http.get<Response>(`${this.apiUrlProcess}/api/reg-ren-validate/listar-reglas`, {
      headers: this.getHeaders()
    });
  }

  saveRegRenValidateRule(regla: RegRenValidate): Observable<Response> {
    return this.http.post<Response>(`${this.apiUrlProcess}/api/reg-ren-validate/insertar`, regla, {
      headers: this.getHeaders()
    });
  }

  getRuleById(id: number): Observable<Response> {
    return this.http.get<Response>(`${this.apiUrlProcess}/api/reg-ren-validate/${id}`, { headers: this.getHeaders() });
  }

  patchRule(rule: RegRenValidate): Observable<Response> {
    return this.http.patch<Response>(`${this.apiUrlProcess}/api/reg-ren-validate/actualizar-regla`, rule, {
      headers: this.getHeaders()
    });
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
  }
}
