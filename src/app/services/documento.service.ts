import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';
import { WrapperUploadDocumento } from '../models/wrappers/wrapper-upload-documento';

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {

  constructor(private http: HttpClient) { }

  token = sessionStorage.getItem('authToken');
  private apiUrlProcess: string = environment.apiUrlProcess;

  uploadImage(wrapper: WrapperUploadDocumento): Observable<any> {
    const formData = new FormData();
    if (wrapper.file) {
      formData.append('file', wrapper.file);
      formData.append('codEmpresa', wrapper.codEmpresa ?? '');
      formData.append('codSucursal', wrapper.codSucursal ?? '');
      formData.append('anioPeriodo', wrapper.anioPeriodo ?? '');
      formData.append('mesPeriodo', wrapper.mesPeriodo ?? '');
      formData.append('tipoDocumento', wrapper.tipoDocumento ?? '');
      formData.append('numOrden', wrapper.numOrden ?? '');
      formData.append('numItem', wrapper.numItem ?? '');
      formData.append('extension', wrapper.extension ?? '');
      const headers = new HttpHeaders({
        Authorization: `Bearer ${this.token}`
      });

      return this.http.post(`${this.apiUrlProcess}documentos/upload`, formData, {
        headers
      });
    } else {
      return of(null);
    }
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
