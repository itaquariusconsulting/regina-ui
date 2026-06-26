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
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);

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
            this.usuarios = this.usuarios.filter(u => u.userId !== user.userId);
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
}
