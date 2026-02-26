import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { MaestrosService } from '../../../services/maestros.service';
import { MaeAuxiliarDTO } from '../../../models/mae-auxiliar-dto';
import { Response } from '../../../models/response';
import { RegSecUser } from '../../../models/reg-sec-user';
import * as bcrypt from 'bcryptjs';
import { RegSecProfileService } from '../../../services/reg-sec-profile.service';
import { RegSecProfile } from '../../../models/reg-sec-profile';
import { RegSecUserService } from '../../../services/reg-sec-user.service';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog-component';
@Component({
  selector: 'app-edit-usuario',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './edit-usuario.component.html',
  styleUrl: './edit-usuario.component.scss'
})
export class EditUsuarioComponent implements OnInit {

  @ViewChild('auxiliarTemplate')
  auxiliarTemplate!: TemplateRef<any>;

  dialogRefAuxiliar!: MatDialogRef<any>;

  defaultSecret: string = 'aquariusconsulting';

  constructor(
    private location: Location,
    private router: Router,
    private dialog: MatDialog,
    private loadingService: LoadingService,
    private maestrosService: MaestrosService,
    private profileService: RegSecProfileService,
    private regSecUserService: RegSecUserService,
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  isLoading$: Observable<boolean>;
  codEmpresa: string = '0001';
  listaAuxiliares: MaeAuxiliarDTO[] = [];
  listaAuxiliaresGenerales: MaeAuxiliarDTO[] = [];
  auxiliarSeleccionado: MaeAuxiliarDTO = new MaeAuxiliarDTO();
  filtroAuxiliar: string = '';
  listaAuxiliaresFiltrada: MaeAuxiliarDTO[] = [];
  usuario: RegSecUser = new RegSecUser();
  profiles: RegSecProfile[] = [];
  profileSeleccionado: RegSecProfile = new RegSecProfile();

  ngOnInit(): void {
    this.getProfiles();
  }

  onBack() {
    this.location.back();
  }

  encriptarPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  getListaAuuxiliares() {
    this.maestrosService.getListaAuxiliares(this.codEmpresa).subscribe(
      (response: Response) => {
        this.listaAuxiliares = response.resultado;
        this.listaAuxiliaresFiltrada = [...response.resultado];
         this.loadingService.hide();
      },
      (error)=>{
         this.loadingService.hide();
      }
    )
  }

  filtrarAuxiliares() {
    const filtro = this.filtroAuxiliar?.toLowerCase() || '';
    this.listaAuxiliaresFiltrada = this.listaAuxiliares.filter(a =>
      (a.desAuxiliar || '').toLowerCase().includes(filtro)
    );
  }

  async seleccionarAuxiliar(auxiliar: MaeAuxiliarDTO) {
    this.auxiliarSeleccionado = auxiliar;
    this.usuario = new RegSecUser();
    this.usuario.userEmail = this.auxiliarSeleccionado.numEmail;
    this.asignarAuxiliarAUsuario(auxiliar);
    this.usuario.userPassword = await this.encriptarPassword(this.defaultSecret);
    this.closeModalAuxiliar();
  }

  asignarAuxiliarAUsuario(auxiliar: MaeAuxiliarDTO) {
    if (!auxiliar?.desAuxiliar) {
      return;
    }

    const partes = auxiliar.desAuxiliar.trim().split(/\s+/);

    const apellidoPaterno = partes[0] || '';
    const apellidoMaterno = partes[1] || '';
    const nombres = partes.slice(2).join(' ');
    this.usuario.codAuxiliar = this.auxiliarSeleccionado.codAuxiliar;
    this.usuario.userLastName = apellidoPaterno;
    this.usuario.userMiddleName = apellidoMaterno;
    this.usuario.userUsername = (nombres.substring(0, 1) + apellidoPaterno + apellidoMaterno.substring(0, 1)).toLowerCase();
    this.usuario.userName = nombres;
  }

  openModalAuxiliar() {
    this.dialogRefAuxiliar = this.dialog.open(this.auxiliarTemplate, {
      width: '90%',
      height: '90%',
      maxWidth: '90%',
      maxHeight: '90%',
      panelClass: 'custom-dialog-container',  // Clase para estilos adicionales
      autoFocus: false
    });
  }

  closeModalAuxiliar() {
    this.dialogRefAuxiliar.close();
  }

  getProfiles() {
    this.loadingService.show();
    this.profileService.getRegSecProfiles().subscribe(
      (response: Response) => {
        this.profiles = response.resultado;
        this.profileSeleccionado = this.profiles[0];
        this.getListaAuuxiliares();
      },
      (error)=>{
         this.loadingService.hide();
      }
    )
  }

  onGuardarUsuario(): void {

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Confirmar',
        message: '¿Deseas guardar los cambios?',
        type: 'confirm'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log("Aqui estoy con result ", result)
        this.usuario.codEmpresa = this.codEmpresa;
        this.usuario.codSucursal = "001";
        this.usuario.profileId = this.profileSeleccionado.profileId;
        this.usuario.profileShortName = this.profileSeleccionado.profileShortName;
        this.usuario.profileType = this.profileSeleccionado.profileType;
        this.usuario.userEnabled = true;
        this.usuario.userStatus = this.usuario.userEnabled ? 'A' : 'I';
        this.regSecUserService.saveRegSecUser(this.usuario).subscribe(
          (response: Response) => {
            this.router.navigate(['/list-usuarios']);
          }
        )
      }
    });
  }
}
