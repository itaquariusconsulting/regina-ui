import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Response } from '../../../models/response';
import { RegSecProfile } from '../../../models/reg-sec-profile';
import { RegSecProfileService } from '../../../services/reg-sec-profile.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { finalize, Observable } from 'rxjs';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';

@Component({
  selector: 'app-list-perfiles',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent, HasPermissionDirective],
  templateUrl: './list-perfiles.component.html',
  styleUrl: './list-perfiles.component.scss'
})
export class ListPerfilesComponent implements OnInit {
  constructor(private profileService: RegSecProfileService,
    private router: Router,
    private loadingService: LoadingService,
    private dialog: MatDialog
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  isLoading$: Observable<boolean>;
  profiles: RegSecProfile[] = [];

  ngOnInit(): void {
    this.getProfiles();
  }

  getProfiles() {
    this.loadingService.show();
    this.profileService.getRegSecProfiles()
      .pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (response: Response) => {
          this.profiles = response.resultado;
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

  onNewProfile() {
    this.router.navigate(['/nuevo-perfil']);
  }

  onEditProfile(id: number) {
    this.router.navigate(['/edit-perfil', id]);
  }

  onDeleteProfile(profile: RegSecProfile): void {
    if (!profile.profileId) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Confirmar Eliminación',
        message: `¿Estás seguro de que deseas eliminar el perfil ${profile.profileShortName}?`,
        type: 'confirm'
      }
    }).afterClosed().subscribe(result => {
      if (!result) return;

      this.loadingService.show();
      this.profileService.deleteProfile(profile.profileId!).subscribe({
        next: (res: Response) => {
          this.loadingService.hide();
          if (res.error === 0) {
            this.profiles = this.profiles.filter(p => p.profileId !== profile.profileId);
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: '¡Éxito!',
                type: 'success',
                message: 'El perfil fue eliminado correctamente.'
              }
            });
          } else {
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: 'Error',
                type: 'alert',
                message: res.mensaje || 'No se pudo eliminar el perfil.'
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
              message: err?.message || 'No se pudo eliminar el perfil.'
            }
          });
        }
      });
    });
  }
}
