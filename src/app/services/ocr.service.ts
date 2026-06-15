import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OcrService {

  constructor(private http: HttpClient) { }

  /**
   * Envía un archivo al OCR backend.
   * @param file Archivo a procesar.
   * @param enhance Si es true activa el modo "mejora fuerte" en el backend
   *   (doble pasada de OCR con preprocesamiento OpenCV completo, devuelve la
   *   versión con mejor score). Úsalo cuando el usuario eligió explícitamente
   *   "Mejorar la imagen" tras un resultado no legible.
   */
  uploadFile(file: File, enhance: boolean = false) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${environment.apiUrlOcr}/ocr/scan?enhance=${enhance}`;
    return this.http.post(url, formData);
  }
}
