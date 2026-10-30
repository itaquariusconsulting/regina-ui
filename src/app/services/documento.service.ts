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

  uploadFile(wrapper: WrapperUploadDocumento): Observable<any> {
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

  /**
   * Abre un archivo subido: un comprobante, una planilla o un voucher.
   *
   * El nombre viaja SIN extension y por eso se la quita aca, en el unico
   * camino que tienen todas las pantallas. El backend arma la ruta como
   * nombre + "." + extension y prueba pdf, png, jpg, jpeg, gif, tiff y bmp
   * hasta dar con el archivo, asi que mandandole "voucher.pdf" buscaba
   * "voucher.pdf.pdf" y devolvia 404.
   *
   * Pasaba solo con los vouchers de devolucion: ahi el nombre sale de
   * ARCHIVO_NOMBRE, que se guarda con extension. Los comprobantes se la
   * quitaban antes de llamar, por eso esos si se abrian y nadie relacionaba
   * las dos cosas. Dejarlo en cada pantalla era esperar que la proxima
   * tambien se acordara.
   */
  viewDocumento(
    tipo: string,
    anio: string,
    mes: string,
    nombre: string
  ): Observable<any> {
    const punto = (nombre ?? '').lastIndexOf('.');
    const base = punto > 0 ? nombre.substring(0, punto) : nombre;

    const headers = new HttpHeaders({
      'Accept': 'application/octet-stream'
    });
    return this.http.get(
      `${this.apiUrlProcess}documentos/view/${tipo}/${anio}/${mes}/${base}`,
      {
        headers,
        responseType: 'blob'
      }
    );
  }
}
