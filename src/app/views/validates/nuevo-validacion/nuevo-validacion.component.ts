import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { RegRenValidate } from '../../../models/reg-ren-validate';
import { Response } from '../../../models/response';

@Component({
  selector: 'app-nuevo-validacion',
  imports: [
    CommonModule,
    FormsModule,
    LoadingDancingSquaresComponent
  ],
  templateUrl: './nuevo-validacion.component.html',
  styleUrl: './nuevo-validacion.component.scss'
})
export class NuevoValidacionComponent implements OnInit {

  isLoading$: Observable<boolean>;

  listaReglas: RegRenValidate[] = [];
  listaReglasFiltrada: RegRenValidate[] = [];
  filtroRegla: string = '';

  regla: RegRenValidate = new RegRenValidate();

  constructor(
    private location: Location,
    private router: Router,
    private dialog: MatDialog,
    private loadingService: LoadingService,
    private regRenValidateService: RegRenValidateService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    this.regla.dataType = "string";
    this.regla.isRequired = true;
    this.regla.isActive = true;
    this.regla.maxLength = 0;
    this.regla.minLength = 0
    this.regla.minValue = 0;
    this.regla.maxValue = 0
    this.cargarReglas();
  }

  onBack() {
    this.location.back();
  }

  cargarReglas(): void {

    this.loadingService.show();

    this.regRenValidateService.getRegRenValidateRules().subscribe({
      next: (resp: Response) => {
        this.listaReglas = resp.resultado || [];
        this.listaReglasFiltrada = [...this.listaReglas];
        this.loadingService.hide();
      },
      error: () => {
        this.loadingService.hide();
      }
    });
  }

  filtrarReglas(): void {

    const filtro = (this.filtroRegla || '').toLowerCase();

    this.listaReglasFiltrada = this.listaReglas.filter(r =>
      (r.fieldCode || '').toLowerCase().includes(filtro) ||
      (r.documentType || '').toLowerCase().includes(filtro) ||
      (r.documentSection || '').toLowerCase().includes(filtro)
    );
  }

  private validarNuevaRegla(): string[] {

    const errores: string[] = [];
    if (!this.regla.ruleName || !this.regla.ruleName.trim()) {
      errores.push('El nombre de la regla es obligatorio.');
    }

    if (!this.regla.fieldCode || !this.regla.fieldCode.trim()) {
      errores.push('El campo a validar es obligatorio.');
    }

    if (!this.regla.dataType) {
      errores.push('El tipo de dato es obligatorio.');
    }

    if (!this.regla.errorMessage || !this.regla.errorMessage.trim()) {
      errores.push('El mensaje de error es obligatorio.');
    }

    if (this.regla.dataType === 'number') {
      if (this.regla.minValue != null && this.regla.maxValue != null
        && this.regla.minValue > this.regla.maxValue) {
        errores.push('El valor mínimo no puede ser mayor que el valor máximo.');
      }
    }

    if (this.regla.dataType === 'string') {
      if (this.regla.minLength != null && this.regla.maxLength != null
        && this.regla.minLength > this.regla.maxLength) {
        errores.push('La longitud mínima no puede ser mayor que la longitud máxima.');
      }
    }

    return errores;
  }

  async onGuardarRegla(): Promise<void> {

    const errores = this.validarNuevaRegla();

    if (errores.length > 0) {

      this.dialog.open(ConfirmDialogComponent, {
        width: '380px',
        data: {
          title: 'Validación',
          message: errores[0],
          type: 'alert'
        }
      });

      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Confirmar',
        message: '¿Deseas guardar los cambios?',
        type: 'confirm'
      }
    });

    dialogRef.afterClosed().subscribe(result => {

      if (!result) {
        return;
      }

      this.regRenValidateService
        .saveRegRenValidateRule(this.regla)
        .subscribe(() => {
          this.router.navigate(['/list-validaciones']);
        });
    });
  }
}
