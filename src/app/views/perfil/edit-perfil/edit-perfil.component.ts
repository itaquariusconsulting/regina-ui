import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { RegSecProfile } from '../../../models/reg-sec-profile';
import { RegSecProfileService } from '../../../services/reg-sec-profile.service';
import { LoadingService } from '../../../services/loading.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';

@Component({
  selector: 'app-edit-perfil',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './edit-perfil.component.html',
  styleUrl: './edit-perfil.component.scss'
})
export class EditPerfilComponent implements OnInit {
  profileId!: number;
  codEmpresa: string = '';
  codSucursal: string = '';
  profileShortName: string = '';
  profileLongName: string = '';
  profileType: string = '';
  isLoading$: Observable<boolean>;

  constructor(
    private route: ActivatedRoute,
    private profileService: RegSecProfileService,
    private router: Router,
    private dialog: MatDialog,
    private location: Location,
    private loadingService: LoadingService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.profileId = +id;
      this.loadProfileData();
    }
  }

  loadProfileData() {
    this.loadingService.show();
    this.profileService.getProfileById(this.profileId).subscribe({
      next: (res) => {
        const data = res.resultado;
        this.codEmpresa = data.codEmpresa;
        this.codSucursal = data.codSucursal;
        this.profileShortName = data.profileShortName;
        this.profileLongName = data.profileLongName;
        this.profileType = data.profileType;
        this.loadingService.hide();
      },
      error: () => this.loadingService.hide()
    });
  }

  onUpdateProfile() {
    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: { title: 'Confirmar Actualización', message: '¿Estás seguro de que deseas guardar los cambios?', type: 'confirm' }
    }).afterClosed().subscribe(result => {
      if (!result) return;

      const profileUpdate: RegSecProfile = {
        profileId: this.profileId,
        codEmpresa: this.codEmpresa,
        codSucursal: this.codSucursal,
        profileShortName: this.profileShortName,
        profileLongName: this.profileLongName,
        profileType: this.profileType
      };

      this.profileService.updateProfile(profileUpdate).subscribe({
        next: () => this.router.navigate(['/list-perfiles']),
        error: (err) => console.error(err)
      });
    });
  }

  onBack() {
    this.location.back();
  }

}
