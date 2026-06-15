import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../environments/environment';


@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isAlertShown = false;

  constructor(private router: Router) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // El token del CORE es el de la SESIÓN: con él verificamos expiración.
    const coreToken = sessionStorage.getItem('authToken');
    if (coreToken) {
      const expirationDate = this.decodeToken(coreToken);
      if (expirationDate && expirationDate < new Date()) {
        this.showSessionExpiredAlert();
        return throwError(() => new Error('TOKEN_EXPIRED'));
      }

      // Los servicios LEGACY (utils/IA/OCR) no confían en el token del CORE;
      // para ellos usamos el token legacy emitido por regina-api en /auth/me.
      const token = this.isLegacyHost(req.url)
        ? (sessionStorage.getItem('legacyToken') || coreToken)
        : coreToken;

      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (req.headers.has('X-Skip-Error-Handler')) {
          return throwError(() => error);
        }
        switch (error.status) {
          case 0:
            Swal.fire('Sin conexión', 'No se pudo conectar con el servidor.', 'error');
            break;
          case 401:
            this.handleUnauthorized(error);
            break;
          case 403:
            Swal.fire('Acceso denegado', 'No tienes permisos para realizar esta acción.', 'warning');
            break;
          case 404:
            Swal.fire('Recurso no encontrado', 'El recurso solicitado no existe.', 'error');
            break;
          case 500:
            Swal.fire('Error del servidor', 'Ocurrió un error interno. Inténtalo más tarde.', 'error');
            break;
          default:
            console.error('Error HTTP:', error);
            Swal.fire('Error', 'Ocurrió un error inesperado.', 'error');
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * True si la URL apunta a un servicio LEGACY (sai-web-utils / IA / OCR) que
   * valida con el validador antiguo y NO confía en el token del CORE.
   */
  private isLegacyHost(url: string): boolean {
    const env = environment as any;
    return [env.apiUrlUtils, env.apiUrlIA, env.apiUrlOcr]
      .filter(Boolean)
      .some((base: string) => url.startsWith(base));
  }

  /**
   * Decodifica un token JWT y obtiene su fecha de expiración
   */
  private decodeToken(token: string): Date | null {
    try {
      const decoded: any = jwtDecode(token);
      if (decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      console.error('Error decodificando el token:', error);
      return null;
    }
  }

  /**
   * Maneja los errores de autenticación (401)
   */
  private handleUnauthorized(error: HttpErrorResponse): void {
    const msg = typeof error.error === 'string' ? error.error : '';

    if (msg === 'TOKEN_EXPIRED' || error.status === 401) {
      this.showSessionExpiredAlert();
    }
  }

  /**
   * Muestra una alerta de sesión expirada y redirige al login
   */
  private showSessionExpiredAlert(): void {
    if (this.isAlertShown) return;
    this.isAlertShown = true;

    Swal.fire({
      title: 'Sesión expirada',
      text: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
      icon: 'warning',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(() => {
      this.isAlertShown = false;
      sessionStorage.clear();
      // En LOCAL (sin CORE) volvemos al login tradicional;
      // en PRODUCCIÓN mostramos la pantalla de bloqueo del CORE.
      const target = environment.production ? '/no-core' : '/login';
      this.router.navigate([target]);
    });
  }

}
