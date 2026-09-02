import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ConfigService {

  private config: Record<string, string> = {};

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<void> {
    try {
      // El ?v= es a proposito y no es un parche feo: config.ini es el unico
      // archivo del build que cambia SIN que cambie su nombre —los bundles
      // llevan hash, este no—, asi que el navegador se queda con la copia
      // vieja en disk cache y la app arranca con la configuracion anterior.
      // Ya paso con las claves ABONO_*: estaban en el servidor y la pantalla
      // las leia vacias. Es un archivo de veinte lineas que se pide una sola
      // vez por carga; que viaje siempre fresco no cuesta nada.
      const data = await firstValueFrom(
        this.http.get(`assets/config.ini?v=${Date.now()}`, { responseType: 'text' })
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