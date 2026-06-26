import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OcrService {

  constructor(private http: HttpClient) { }

  /**
   * Envía un archivo al OCR backend y devuelve SOLO el body de la respuesta.
   * Mantenido por compatibilidad con código existente que no necesita
   * progreso de subida.
   */
  uploadFile(file: File, enhance: boolean = false) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${environment.apiUrlOcr}/ocr/scan?enhance=${enhance}`;
    return this.http.post(url, formData);
  }

  /**
   * Igual que `uploadFile`, pero devuelve TODOS los eventos HTTP
   * (UploadProgress, ResponseHeader, Response) para que el componente
   * pueda detectar momentos reales del proceso:
   *
   *   - HttpEventType.UploadProgress  → la imagen está subiéndose
   *   - HttpEventType.UploadProgress (loaded === total)
   *                                    → la subida terminó, el server
   *                                      empieza a procesar el OCR
   *   - HttpEventType.ResponseHeader   → el server empezó a responder
   *                                      (OCR terminado)
   *   - HttpEventType.Response         → llegó el body completo con datos
   *
   * Permite que el overlay avance "Subiendo archivo" → "Aplicando OCR"
   * → "Identificando datos" por eventos REALES, en lugar de quedarse
   * congelado en la primera fase mientras el server procesa.
   */
  uploadFileWithProgress(file: File, enhance: boolean = false): Observable<HttpEvent<any>> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${environment.apiUrlOcr}/ocr/scan?enhance=${enhance}`;
    const req = new HttpRequest('POST', url, formData, {
      reportProgress: true,
    });
    return this.http.request(req);
  }
}
