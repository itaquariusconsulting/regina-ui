import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { WrapperRequestIA } from '../models/wrappers/wrapper-request-ia';
import { environment } from '../../environments/environment';

/**
 * Filtros para listar órdenes de pago detectados por el chat IA
 * (regina-api-2 → OrdenPagoFilterParser). Cada campo es opcional —
 * solo viene poblado el que se detectó en el mensaje.
 */
export interface OrdenPagoFilterIA {
  numOrden?: string;          // padded a 9 dígitos ('000016179')
  nombre?: string;
  apellido?: string;
  nombreCompleto?: string;
  anio?: number;
  mes?: number;               // 1-12
  mesTexto?: string;          // "junio"
  centroCosto?: string;
}

// Interfaz para tipar la respuesta del servicio FastAPI / regina-api-2
export interface ChatResponse {
  tipo: string;
  respuesta: any;
  /** Filtros parseados cuando tipo === 'ordenes'. */
  filtros?: OrdenPagoFilterIA;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class ReginaIaService {

  constructor(private http: HttpClient) { }
  
  enviarPregunta(payload: WrapperRequestIA): Observable<ChatResponse> {
    const url = `${environment.apiUrlIA}/chat`;

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
