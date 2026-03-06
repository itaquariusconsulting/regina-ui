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

  getRegSecProfiles(): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiUrlAuth}/api/profile/listar`, {
      headers,
      responseType: 'json'
    });
  }

  saveProfile(profile: RegSecProfile): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.post<Response>(`${this.apiUrlAuth}/api/profile/guardar`, profile, {
      headers,
      responseType: 'json'
    });
  }
}
