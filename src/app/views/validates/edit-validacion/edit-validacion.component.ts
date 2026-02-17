import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog-component';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { RegRenValidate } from '../../../models/reg-ren-validate';
import { Response } from '../../../models/response';

@Component({
  selector: 'app-edit-reg-ren-validate',
  imports: [
    CommonModule,
    FormsModule,
    LoadingDancingSquaresComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './edit-validacion.component.html',
  styleUrl: './edit-validacion.component.scss'
})
export class EditRegRenValidateComponent implements OnInit {

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
    this.regla.dataType="01";
    this.regla.isRequired = true;
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

  private async validarReglaConTabla(): Promise<string[]> {

    const errores: string[] = [];

    const response: Response = await firstValueFrom(
      this.regRenValidateService.getRegRenValidateRules()
    );

    const reglas: RegRenValidate[] = response.resultado || [];

    for (const rule of reglas) {

      const field = rule.fieldCode;

      if (!field) {
        continue;
      }

      const value = (this.regla as any)[field];

      if (rule.dependsOnField) {
        const dep = (this.regla as any)[rule.dependsOnField];
        if (String(dep) !== String(rule.dependsOnValue)) {
          continue;
        }
      }

      if (rule.isRequired) {
        if (value === null || value === undefined || value === '') {
          errores.push(rule.errorMessage ?? 'Error de validación' ?? 'Error de validación');
          continue;
        }
      }

      if (value === null || value === undefined || value === '') {
        continue;
      }

      if (rule.dataType === 'number') {

        const n = Number(value);

        if (isNaN(n)) {
          errores.push(rule.errorMessage ?? 'Error de validación');
          continue;
        }

        if (rule.minValue != null && n < rule.minValue) {
          errores.push(rule.errorMessage ?? 'Error de validación');
        }

        if (rule.maxValue != null && n > rule.maxValue) {
          errores.push(rule.errorMessage ?? 'Error de validación');
        }
      }

      if (rule.dataType === 'string') {

        const s = String(value);

        if (rule.minLength != null && s.length < rule.minLength) {
          errores.push(rule.errorMessage ?? 'Error de validación');
        }

        if (rule.maxLength != null && s.length > rule.maxLength) {
          errores.push(rule.errorMessage ?? 'Error de validación');
        }

        if (rule.regexPattern) {
          const reg = new RegExp(rule.regexPattern);
          if (!reg.test(s)) {
            errores.push(rule.errorMessage ?? 'Error de validación');
          }
        }

        if (rule.allowedValues) {

          const allowed = rule.allowedValues
            .split(',')
            .map(v => v.trim());

          if (!allowed.includes(s)) {
            errores.push(rule.errorMessage ?? 'Error de validación');
          }
        }
      }
    }

    return errores;
  }

  async onGuardarRegla(): Promise<void> {

    const errores = await this.validarReglaConTabla();

    if (errores.length > 0) {

      this.dialog.open(ConfirmDialogComponent, {
        width: '380px',
        data: {
          title: 'Validación',
          message: errores[0]
        }
      });

      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Confirmar',
        message: '¿Deseas guardar los cambios?'
      }
    });

    dialogRef.afterClosed().subscribe(result => {

      if (!result) {
        return;
      }

      this.regRenValidateService
        .saveRegRenValidateRule(this.regla)
        .subscribe(() => {
          this.router.navigate(['/list-reg-ren-validate']);
        });
    });
  }
}
