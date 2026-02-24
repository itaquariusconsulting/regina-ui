import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OcrService {

  constructor(private http: HttpClient) { }

  uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${environment.apiUrlOcr}/ocr/scan`, formData);
  }
}
