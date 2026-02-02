import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  private baseUrl = 'http://localhost:6700'; // Cambiar por tu IP o localhost

  constructor(private http: HttpClient) { }

  enviarPregunta(
    mensaje: string,
    codEmpresa?: string,
    codSucursal?: string,
    anoPeriodo?: string,
    codPeriodo?: string,
    codAuxiliar?: string
  ): Observable<ChatResponse> {

    const payload: any = { mensaje };

    if (codEmpresa) payload.codEmpresa = codEmpresa;
    if (codSucursal) payload.codSucursal = codSucursal;
    if (anoPeriodo) payload.anoPeriodo = anoPeriodo;
    if (codPeriodo) payload.codPeriodo = codPeriodo;
    if (codAuxiliar) payload.codAuxiliar = codAuxiliar;

    return this.http.post<ChatResponse>(`${this.baseUrl}/chat`, payload);
  }
}
