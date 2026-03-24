import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Response } from '../models/response';
import { environment } from '../../environments/environment';
import { RegSecProfile } from '../models/reg-sec-profile';

@Injectable({
  providedIn: 'root'
})
export class RegSecProfileService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  apiUrlProcess: string = environment.apiUrlProcess;
  apiUrlAuth: string = environment.apiUrlAuth;

  getProfileById(id: number): Observable<Response> {
    return this.http.get<Response>(`${this.apiUrlAuth}/api/profile/${id}`, { headers: this.getHeaders() });
  }

  getRegSecProfiles(): Observable<Response> {
    return this.http.get<Response>(`${this.apiUrlAuth}/api/profile/listar`, { headers: this.getHeaders() });
  }

  saveProfile(profile: RegSecProfile): Observable<Response> {
    return this.http.post<Response>(`${this.apiUrlAuth}/api/profile/guardar`, profile, { headers: this.getHeaders() });
  }

  updateProfile(profile: RegSecProfile): Observable<Response> {
    return this.http.put<Response>(`${this.apiUrlAuth}/api/profile/actualizar`, profile, { headers: this.getHeaders() });
  }

  deleteProfile(id: number): Observable<Response> {
    return this.http.delete<Response>(`${this.apiUrlAuth}/api/profile/eliminar/${id}`, { 
      headers: this.getHeaders({ skipErrorHandler: true }) 
    });
  }

  private getHeaders(options?: { skipErrorHandler?: boolean }): HttpHeaders {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };

    if (options?.skipErrorHandler) {
      headers['X-Skip-Error-Handler'] = 'true';
    }

    return new HttpHeaders(headers);
  }
}
