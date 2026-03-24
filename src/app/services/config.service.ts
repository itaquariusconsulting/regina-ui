import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ConfigService {

  private config: Record<string, string> = {};

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get('assets/config.ini', { responseType: 'text' })
      );

      if (!data) {
        throw new Error('Archivo config.ini vacío');
      }

      this.config = this.parseIni(data);
    } catch (error) {
      console.error('Error cargando config.ini', error);
      throw error;
    }
  }

  private parseIni(data: string): Record<string, string> {
    const result: Record<string, string> = {};

    data.split('\n').forEach(line => {
      const cleanLine = line.trim();

      // ignorar líneas vacías o comentarios
      if (!cleanLine || cleanLine.startsWith('#') || cleanLine.startsWith(';')) {
        return;
      }

      const [key, value] = cleanLine.split('=');

      if (key && value) {
        result[key.trim()] = value.trim().replace('\r', '');
      }
    });

    return result;
  }

  get(key: string): string {
    return this.config[key] ?? '';
  }
}