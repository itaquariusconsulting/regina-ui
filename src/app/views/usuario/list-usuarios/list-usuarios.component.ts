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

@Component({
  selector: 'app-list-usuarios',
  imports: [CommonModule, FormsModule, HasPermissionDirective, LoadingDancingSquaresComponent],
  templateUrl: './list-usuarios.component.html',
  styleUrl: './list-usuarios.component.scss'
})
export class ListUsuariosComponent implements OnInit{
  constructor(private regSecUserService: RegSecUserService, private location: Location,
    private router: Router,
    private dialog: MatDialog,
    private loadingService: LoadingService
  ) { 
    this.isLoading$ = this.loadingService.loading$;
  }

  @ViewChild('myTable', { static: true }) tableRef!: ElementRef;

  usuarios: RegSecUser[] = [];
  wrapperRequestUsuario: WrapperRequestUsuario = new WrapperRequestUsuario();
  isLoading$: Observable<boolean>;

  ngOnInit(): void {
    const userString = sessionStorage.getItem('user');
    const state = history.state;

    if (userString) {
      try {
        const user = JSON.parse(userString);
        this.wrapperRequestUsuario.codEmpresa = user.codEmpresa || '';
        this.wrapperRequestUsuario.codSucursal = user.codSucursal || '';
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
        this.loadingService.hide();
      }
    );
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
