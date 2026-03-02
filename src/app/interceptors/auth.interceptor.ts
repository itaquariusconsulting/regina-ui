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


@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isAlertShown = false;

  constructor(private router: Router) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = sessionStorage.getItem('authToken');
    if (token) {
      const expirationDate = this.decodeToken(token);
      if (expirationDate && expirationDate < new Date()) {
        this.showSessionExpiredAlert();
        return throwError(() => new Error('TOKEN_EXPIRED'));
      }

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
      this.router.navigate(['/login']);
    });
  }

}
