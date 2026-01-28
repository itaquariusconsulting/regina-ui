import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { Response } from '../models/response';
import { RegSecUser } from '../models/reg-sec-user';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) { }

    private secretKey = '4qvr1v520251234z'; // Debe ser de 16, 24 o 32 bytes
  private authStatusListener = new BehaviorSubject<boolean>(this.isLoggedIn());

  apiurlAuth = environment.apiUrlAuth;
  token = sessionStorage.getItem('authToken');

  login(dto: RegSecUser): Observable<any> {
    const url = this.apiurlAuth + "/api/auth/autenticar";
    console.log(url);
    return this.http.post(this.apiurlAuth + "/api/auth/autenticar", dto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
  }

  otp(dto: RegSecUser): Observable<any> {
    return this.http.post(this.apiurlAuth + "otp", dto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
  }

  // Método para verificar si el usuario está autenticado
  isLoggedIn(): boolean {
    const token = localStorage.getItem('authToken');
    return !!token && !this.isTokenExpired(token);
  }

  // Método para verificar si el token ha expirado
  isTokenExpired(token: string): boolean {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationDate = new Date(payload.exp * 1000);
    return expirationDate <= new Date();
  }

  // Método para establecer el token y notificar el estado de autenticación
  setToken(token: string): void {
    localStorage.setItem('authToken', token);
    this.authStatusListener.next(true); // El usuario está autenticado
  }

  // Método para cerrar sesión
  logout(): void {
    console.log("Hola");
    localStorage.removeItem('authToken');
    this.authStatusListener.next(false); // El usuario ha cerrado sesión
  }

  getAuthStatusListener() {
    return this.authStatusListener.asObservable();
  }

  async setDataAuditoria() {
    this.obtieneIP().subscribe(
      (response: Response) => {
        sessionStorage.setItem('ip', response.resultado);
      }
    )

    const fp = await FingerprintJS.load();
    const result = await fp.get();
    sessionStorage.setItem('fingerprint', result.visitorId);
  }

  obtieneIP(): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiurlAuth}obtenerIp`, {
      headers
    });
  }

  changePassword(dto: RegSecUser): Observable<any> {
    return this.http.put(`${this.apiurlAuth}usuario/change-password`, dto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
  }
}
