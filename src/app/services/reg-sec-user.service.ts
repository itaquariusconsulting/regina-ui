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
   * Usa el endpoint dedicado PATCH `/api/usuario/{id}/password`.
   *
   * Antes reutilizaba `actualizar-parcial`, que NO toca USER_PASSWORD y que,
   * al recibir el resto de los campos en null, borraba nombre, apellidos,
   * username y perfil del usuario. La contraseña nunca cambiaba y el registro
   * quedaba destruido.
   */
  changeUserPasswordAsAdmin(userId: number, newPassword: string): Observable<Response> {
    return this.http.patch<Response>(
      `${this.apiUrlAuth}/api/usuario/${userId}/password`,
      { userPassword: newPassword },
      { headers: this.getHeaders() }
    );
  }

  deleteUser(id: number): Observable<Response> {
    return this.http.delete<Response>(`${this.apiUrlAuth}/api/usuario/eliminar/${id}`, {
      headers: this.getHeaders()
    });
  }

  private getHeaders(): HttpHeaders {
    // Se lee en cada llamada: el servicio es singleton, y guardarlo en el campo
    // hacia que tras un re-login se siguiera enviando el token anterior.
    const token = sessionStorage.getItem('authToken') ?? this.token;
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  updateThemePreference(userId: number, theme: string): Observable<Response> {
    // El segundo argumento de http.put es el CUERPO, no las opciones: antes se
    // enviaba el objeto de headers como body y la peticion iba sin Authorization.
    return this.http.put<Response>(
      `${this.apiUrlAuth}/api/theme/update/${userId}/${theme}`,
      {},
      { headers: this.getHeaders() }
    );
  }
}
