import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegSecUser } from '../../../models/reg-sec-user';
import { RegSecUserService } from '../../../services/reg-sec-user.service';
import { WrapperRequestUsuario } from '../../../models/wrappers/wrapper-request-usuario';
import { Response } from '../../../models/response';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import {
  ChangePasswordDialogComponent,
  ChangePasswordDialogData,
  ChangePasswordDialogResult,
} from '../../../components/dialogs/change-password-dialog.component';
import {
  EnviarCredencialesDialogComponent,
  EnviarCredencialesDialogData,
  EnviarCredencialesDialogResult,
} from '../../../components/dialogs/enviar-credenciales-dialog.component';
import {
  ResultadoCredencialesDialogComponent,
  ResultadoEnvioCredencial,
} from '../../../components/dialogs/resultado-credenciales-dialog.component';

@Component({
  selector: 'app-list-usuarios',
  imports: [CommonModule, FormsModule, HasPermissionDirective, LoadingDancingSquaresComponent],
  templateUrl: './list-usuarios.component.html',
  styleUrl: './list-usuarios.component.scss'
})
export class ListUsuariosComponent implements OnInit {
  constructor(private regSecUserService: RegSecUserService, private location: Location,
    private router: Router,
    private dialog: MatDialog,
    private loadingService: LoadingService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  @ViewChild('myTable', { static: true }) tableRef!: ElementRef;

  usuarios: RegSecUser[] = [];
  pagedUsuarios: RegSecUser[] = [];
  wrapperRequestUsuario: WrapperRequestUsuario = new WrapperRequestUsuario();
  isLoading$: Observable<boolean>;

  /**
   * True si el usuario logueado es administrador. Lo leemos UNA SOLA VEZ
   * en ngOnInit desde sessionStorage para mostrar/ocultar el botón de
   * cambiar contraseña. Se usa con `*ngIf="isAdminUser"` en el HTML.
   */
  isAdminUser: boolean = false;

  /** USER_ID del que esta usando la pantalla. Lo exige el backend. */
  usuarioActualId: number | null = null;

  /** Lo responde el backend: admin + servidor de correo configurado. */
  puedeEnviarCredenciales = false;
  correoConfigurado = false;

  /** Usuarios tildados para el envio. Sobrevive al cambio de pagina. */
  seleccionados = new Set<number>();

  pageSize = 8;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;

  ngOnInit(): void {
    const userString = sessionStorage.getItem('user');
    const state = history.state;
    if (userString) {
      try {
        const user = JSON.parse(userString);
        this.wrapperRequestUsuario.codEmpresa = user.codEmpresa || '';
        this.wrapperRequestUsuario.codSucursal = user.codSucursal || '';
        // 🆕 Bandera de admin para gating del botón "Cambiar contraseña".
        // Se guarda con la misma convención que el resto de la app
        // (booleano `userAdmin` en RegSecUser).
        this.isAdminUser = !!user.userAdmin;
        this.usuarioActualId = user.userId ?? null;
        this.consultarEstadoCredenciales();
        if (state.data) {
          this.usuarios = state.data.resultado;
        } else {
          this.getUsuarios();
        }
      } catch (e) {
        console.error('Error al parsear User desde sessionStorage', e);
      }
    }
  }

  getUsuarios() {
    this.loadingService.show();
    this.regSecUserService.getRegSecUsers(this.wrapperRequestUsuario).subscribe(
      (response: Response) => {
        this.usuarios = response.resultado || [];
        this.currentPage = 0;
        this.buildPagination();
        this.loadingService.hide();
      }
    );
  }

  private buildPagination(): void {

    this.totalItems = this.usuarios.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));

    // Si la lista se achico y la pagina actual quedo fuera de rango, se
    // retrocede: si no, la tabla aparece vacia sin explicacion.
    if (this.currentPage >= this.totalPages) {
      this.currentPage = this.totalPages - 1;
    }

    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;

    this.pagedUsuarios = this.usuarios.slice(start, end);
  }

  changePage(page: number): void {
    if (page < 0 || page >= this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.buildPagination();
  }

  onBack() {
    this.location.back();
  }

  onNewUser() {
    this.router.navigate(['/nuevo-usuario']);
  }

  onEditUser(id: number) {
    this.router.navigate(['/edit-usuario', id]);
  }

  /**
   * Abre el diálogo de cambio de contraseña y, si el admin confirma,
   * llama al servicio para persistir el cambio.
   *
   * Pre-condición: el botón en el HTML solo se muestra cuando
   * `isAdminUser === true`, así que esta función NO debería ejecutarse
   * para un usuario no admin. Igual añadimos una segunda barrera en
   * runtime por defensa en profundidad.
   */
  onChangePassword(user: RegSecUser): void {
    if (!this.isAdminUser) {
      console.warn('[list-usuarios] onChangePassword bloqueado: usuario no es admin');
      return;
    }
    if (!user || !user.userId) return;

    const ref = this.dialog.open<
      ChangePasswordDialogComponent,
      ChangePasswordDialogData,
      ChangePasswordDialogResult | null
    >(ChangePasswordDialogComponent, {
      width: '380px',
      data: { targetUsername: user.userUsername || `(id ${user.userId})` },
      disableClose: true,
    });

    ref.afterClosed().subscribe(result => {
      if (!result || !result.newPassword) return;

      this.loadingService.show();
      this.regSecUserService
        .changeUserPasswordAsAdmin(user.userId!, result.newPassword)
        .subscribe({
          next: (res: Response) => {
            this.loadingService.hide();
            if (res?.error === 0) {
              this.dialog.open(ConfirmDialogComponent, {
                width: '320px',
                data: {
                  title: '¡Contraseña actualizada!',
                  type: 'success',
                  message: `La contraseña de ${user.userUsername} fue cambiada correctamente.`,
                },
              });
            } else {
              this.dialog.open(ConfirmDialogComponent, {
                width: '320px',
                data: {
                  title: 'No se pudo cambiar',
                  type: 'alert',
                  message: res?.mensaje || 'El servidor rechazó el cambio de contraseña.',
                },
              });
            }
          },
          error: (err) => {
            this.loadingService.hide();
            this.dialog.open(ConfirmDialogComponent, {
              width: '320px',
              data: {
                title: 'Error de conexión',
                type: 'alert',
                message: err?.error?.mensaje || err?.message || 'No se pudo contactar al servidor.',
              },
            });
          },
        });
    });
  }

  onDeleteUser(user: RegSecUser): void {
    if (!user.userId) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Confirmar Eliminación',
        message: `¿Estás seguro de que deseas eliminar al usuario ${user.userUsername}?`,
        type: 'confirm'
      }
    }).afterClosed().subscribe(result => {
      if (!result) return;

      this.loadingService.show();
      this.regSecUserService.deleteUser(user.userId!).subscribe({
        next: (res: Response) => {
          this.loadingService.hide();
          if (res.error === 0) {
            // Se relee del servidor en lugar de filtrar el arreglo local: el
            // borrado toca tres tablas y la lista podria quedar desincronizada.
            //
            // Antes solo se filtraba `usuarios`, pero la tabla renderiza
            // `pagedUsuarios`, que arma buildPagination(). Como no se volvia a
            // llamar, el usuario borrado seguia visible hasta recargar.
            this.getUsuarios();
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: '¡Éxito!',
                type: 'success',
                message: 'El usuario fue eliminado correctamente.'
              }
            });
          } else {
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: 'Error',
                type: 'alert',
                message: res.mensaje || 'No se pudo eliminar el usuario.'
              }
            });
          }
        },
        error: (err) => {
          this.loadingService.hide();
          this.dialog.open(ConfirmDialogComponent, {
            width: '280px',
            data: {
              title: 'Error de Conexión',
              type: 'alert',
              message: err?.message || 'No se pudo eliminar el usuario.'
            }
          });
        }
      });
    });
  }

  // ------------------------------------------------------------------
  // Envio de credenciales
  // ------------------------------------------------------------------

  private consultarEstadoCredenciales(): void {
    if (!this.usuarioActualId) { return; }

    this.regSecUserService.getEstadoCredenciales(this.usuarioActualId).subscribe({
      next: (res: Response) => {
        const estado = res?.resultado || {};
        this.puedeEnviarCredenciales = !!estado.esAdministrador;
        this.correoConfigurado = !!estado.correoConfigurado;
      },
      // Si el backend desplegado todavia no tiene el endpoint, la pantalla
      // sigue funcionando: simplemente no aparece el boton.
      error: () => { this.puedeEnviarCredenciales = false; },
    });
  }

  estaSeleccionado(userId?: number): boolean {
    return !!userId && this.seleccionados.has(userId);
  }

  alternarSeleccion(user: RegSecUser): void {
    if (!user.userId) { return; }
    if (this.seleccionados.has(user.userId)) {
      this.seleccionados.delete(user.userId);
    } else {
      this.seleccionados.add(user.userId);
    }
  }

  /** El tilde de la cabecera actua sobre la pagina visible, no sobre todo. */
  get todaLaPaginaSeleccionada(): boolean {
    const conId = this.pagedUsuarios.filter(u => !!u.userId);
    return conId.length > 0 && conId.every(u => this.seleccionados.has(u.userId!));
  }

  alternarPagina(): void {
    if (this.todaLaPaginaSeleccionada) {
      this.pagedUsuarios.forEach(u => u.userId && this.seleccionados.delete(u.userId));
    } else {
      this.pagedUsuarios.forEach(u => u.userId && this.seleccionados.add(u.userId));
    }
  }

  seleccionarTodos(): void {
    this.usuarios.forEach(u => u.userId && this.seleccionados.add(u.userId));
  }

  limpiarSeleccion(): void {
    this.seleccionados.clear();
  }

  onEnviarCredenciales(): void {

    if (!this.puedeEnviarCredenciales || !this.usuarioActualId) { return; }

    const ids = Array.from(this.seleccionados);
    if (ids.length === 0) { return; }

    const sinCorreo = this.usuarios
      .filter(u => u.userId && ids.includes(u.userId))
      .filter(u => !u.userEmail || !u.userEmail.trim()).length;

    const correoAdmin = this.usuarios.find(u => u.userId === this.usuarioActualId)?.userEmail || '';

    const ref = this.dialog.open<
      EnviarCredencialesDialogComponent,
      EnviarCredencialesDialogData,
      EnviarCredencialesDialogResult | null
    >(EnviarCredencialesDialogComponent, {
      width: '520px',
      data: { cantidad: ids.length, sinCorreo, correoAdmin },
      disableClose: true,
    });

    ref.afterClosed().subscribe(opciones => {
      if (!opciones) { return; }

      this.loadingService.show();

      this.regSecUserService.enviarCredenciales({
        solicitanteUserId: this.usuarioActualId!,
        userIds: ids,
        modoContrasena: opciones.modoContrasena,
        contrasenaFija: opciones.contrasenaFija,
        correoDePrueba: opciones.correoDePrueba,
      }).subscribe({
        next: (res: Response) => {
          this.loadingService.hide();

          const filas: ResultadoEnvioCredencial[] = res?.resultado || [];

          if (filas.length > 0) {
            this.dialog.open(ResultadoCredencialesDialogComponent, {
              width: '760px',
              data: filas,
            });
            // Solo se limpia lo que efectivamente salio: lo que fallo queda
            // tildado para poder reintentarlo sin volver a buscarlo.
            filas.filter(f => f.enviado).forEach(f => this.seleccionados.delete(f.userId));
          } else {
            this.dialog.open(ConfirmDialogComponent, {
              width: '320px',
              data: {
                title: 'Sin envios',
                type: 'alert',
                message: res?.mensaje || 'No se envio ningun correo.',
              },
            });
          }
        },
        error: (err) => {
          this.loadingService.hide();
          this.dialog.open(ConfirmDialogComponent, {
            width: '340px',
            data: {
              title: 'No se pudo enviar',
              type: 'alert',
              message: err?.error?.mensaje || err?.message || 'No se pudo contactar al servidor.',
            },
          });
        },
      });
    });
  }

  onCargaMasiva(): void {
    this.router.navigate(['/carga-masiva-usuarios']);
  }
}
