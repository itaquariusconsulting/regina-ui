import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Response } from '../models/response';
import { environment } from '../../environments/environment';
import { WrapperRequestUsuario } from '../models/wrappers/wrapper-request-usuario';
import { RegSecUser } from '../models/reg-sec-user';

@Injectable({
  providedIn: 'root'
})
export class RegSecUserService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  apiUrlProcess: string = environment.apiUrlProcess;
  apiUrlAuth: string = environment.apiUrlAuth;

  getRegSecUsers(wrapper: WrapperRequestUsuario): Observable<Response> {
    return this.http.get<Response>(`${this.apiUrlAuth}/api/usuario/listar/${wrapper.codEmpresa}/${wrapper.codSucursal}`, {
      headers: this.getHeaders()
    });
  }

  saveRegSecUser(usuario: RegSecUser): Observable<Response> {
    return this.http.post<Response>(`${this.apiUrlAuth}/api/usuario/guardar`, usuario, {
      headers: this.getHeaders(),
    });
  }

  getUserById(id: number): Observable<Response> {
    return this.http.get<Response>(`${this.apiUrlAuth}/api/usuario/${id}`, { headers: this.getHeaders() });
  }

  patchUser(user: RegSecUser): Observable<Response> {
    return this.http.patch<Response>(`${this.apiUrlAuth}/api/usuario/actualizar-parcial`, user, {
      headers: this.getHeaders()
    });
  }

  /**
   * Cambia la contraseña de un usuario específico (operación de admin).
   *
   * Reutiliza el endpoint PATCH `actualizar-parcial` enviando SOLO el
   * userId y la nueva contraseña, así el backend no toca otros campos
   * del registro (apellidos, perfil, status, etc.).
   *
   * Si el backend tuviera un endpoint dedicado (ej. `/api/usuario/{id}/password`)
   * sería preferible cambiarlo aquí para mejor auditoría — por ahora
   * vamos por PATCH para no romper compatibilidad.
   */
  changeUserPasswordAsAdmin(userId: number, newPassword: string): Observable<Response> {
    const partial: RegSecUser = new RegSecUser();
    partial.userId = userId;
    partial.userPassword = newPassword;
    return this.http.patch<Response>(`${this.apiUrlAuth}/api/usuario/actualizar-parcial`, partial, {
      headers: this.getHeaders(),
    });
  }

  deleteUser(id: number): Observable<Response> {
    return this.http.delete<Response>(`${this.apiUrlAuth}/api/usuario/eliminar/${id}`, {
      headers: this.getHeaders()
    });
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
  }

  updateThemePreference(userId: number, theme: string): Observable<Response> {
    const body = { themePreference: theme };
    return this.http.put<Response>(`${this.apiUrlAuth}/api/theme/update/${userId}/${theme}`, {
      headers: this.getHeaders()
    });
  }
}
