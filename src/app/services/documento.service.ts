import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  private apiUrlProcess: string = environment.apiUrlProcess;

  uploadImage(file: File,
    tipoDocumento: string,
    anioPeriodo: string,
    mesPeriodo: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipoDocumento', tipoDocumento);
    formData.append('anioPeriodo', anioPeriodo);
    formData.append('mesPeriodo', mesPeriodo);

    return this.http.post<Response>(`${this.apiUrlProcess}/upload`, formData, {
      headers,
      responseType: 'json'
    });
  }

  viewDocumento(
    tipo: string,
    anio: string,
    mes: string,
    nombre: string
  ): Observable<any> {

    const headers = new HttpHeaders({
      'Accept': 'application/octet-stream'
    });

    return this.http.get(
      `${this.apiUrlProcess}documentos/view/${tipo}/${anio}/${mes}/${nombre}`,
      {
        headers,
        responseType: 'blob'
      }
    );

  }
}
