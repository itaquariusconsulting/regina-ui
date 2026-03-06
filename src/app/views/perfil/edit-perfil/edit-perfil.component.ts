import { Component } from '@angular/core';
import { RegSecProfileService } from '../../../services/reg-sec-profile.service';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog-component';
import { RegSecProfile } from '../../../models/reg-sec-profile';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';

@Component({
  selector: 'app-edit-perfil',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './edit-perfil.component.html',
  styleUrl: './edit-perfil.component.scss'
})
export class EditPerfilComponent {
  codEmpresa: string = '';
  codSucursal: string = '';
  profileShortName: string = '';
  profileLongName: string = '';
  profileType: string = '';

  constructor(private profileService: RegSecProfileService,
    private router: Router,
    private dialog: MatDialog,
    private location: Location,
    private loadingService: LoadingService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  isLoading$: Observable<boolean>;
  
  onSaveProfile() {
    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Confirmar',
        message: '¿Deseas guardar el nuevo perfil?',
        type: 'confirm'
      }
    }).afterClosed().subscribe(result => {
      if (!result) return;

      const nuevoPerfil: RegSecProfile = {
        codEmpresa: this.codEmpresa,
        codSucursal: this.codSucursal,
        profileShortName: this.profileShortName,
        profileLongName: this.profileLongName,
        profileType: this.profileType
      };

      this.profileService.saveProfile(nuevoPerfil).subscribe({
        next: () => {
          this.router.navigate(['/list-perfiles']);
        },
        error: (err) => {
          console.error("Error al guardar nuevo perfil:", err);
        }
      });
    });
  }

  onBack() {
    this.location.back();
  }
}
