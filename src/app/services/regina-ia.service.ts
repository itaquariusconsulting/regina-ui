import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
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
  
  enviarPregunta(payload: WrapperRequestIA): Observable<ChatResponse> {
    const url = `${environment.apiUrlIA}/stream`;

    return this.http.post<ChatResponse>(url, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error al enviar la pregunta:', error);

        // Aquí puedes transformar el error como quieras
        const errorMsg = error.error?.message || 'Error desconocido';

        // Lo devuelves para que el componente lo reciba
        return throwError(() => errorMsg);
      })
    );
  }
}
