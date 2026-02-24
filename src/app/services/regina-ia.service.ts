import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WrapperRequestIA } from '../models/wrappers/wrapper-request-ia';
import { environment } from '../../environments/environment';

// Interfaz para tipar la respuesta del servicio FastAPI
export interface ChatResponse {
  tipo: string;
  respuesta: any;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class ReginaIaService {

  constructor(private http: HttpClient) { }

  enviarPregunta(payload: WrapperRequestIA
  ): Observable<ChatResponse> {
    try {
    return this.http.post<ChatResponse>(`${environment.apiUrlIA}/chat`, payload);
  } catch (error) {
    console.error('Error al enviar la pregunta:', error);
    throw error;
  } 
}
}
