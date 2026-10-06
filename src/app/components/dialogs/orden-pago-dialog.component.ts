import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { OrdenPagoPropia } from '../../models/orden-pago-propia';

/**
 * Lo que recibe el diálogo.
 *
 * `orden` vacío significa alta. Si viene cargada, es edición y el número de
 * orden se muestra pero no se toca: lo asignó el servidor.
 */
export interface OrdenPagoDialogData {
  orden?: OrdenPagoPropia;
  /** Reparos devueltos por el servidor en un intento anterior. */
  reparos?: string[];
}

/**
 * Carga y edición de una orden de pago por rendir.
 *
 * Diálogo y no pantalla aparte porque son siete campos y no hay renglones de
 * detalle: el usuario no pierde de vista la lista mientras carga, y no hay que
 * pasar datos por el estado del router —que se pierde si recarga con F5.
 *
 * Las validaciones de acá son una cortesía para avisar antes de que se moleste
 * en llenar todo. Las que mandan están en el backend, que es el que queda
 * publicado y al que se puede llamar sin pasar por el navegador.
 */
@Component({
  selector: 'app-orden-pago-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>
      <i class="fa-solid" [ngClass]="esNueva ? 'fa-plus' : 'fa-pen'"
         style="color: var(--primary-color);"></i>
      <span class="ms-2">{{ esNueva ? 'Nueva orden de pago' : 'Orden ' + orden.numOrden }}</span>
    </h2>

    <mat-dialog-content>

      <!-- Lo que devolvió el servidor, si rebotó un intento anterior. -->
      <div class="alert alert-danger py-2 px-3 mb-3" *ngIf="reparos.length">
        <div class="fw-semibold mb-1">Revise estos puntos</div>
        <ul class="mb-0 ps-3 small">
          <li *ngFor="let r of reparos">{{ r }}</li>
        </ul>
      </div>

      <div class="row g-3">

        <div class="col-12 col-md-7">
          <label class="form-label fw-semibold">Persona <span class="text-danger">*</span></label>
          <input class="form-control" [(ngModel)]="orden.codAuxiliar" maxlength="6"
                 placeholder="Código de la persona" (ngModelChange)="limpiarAviso()">
          <div class="form-text">A quién se le entrega el dinero.</div>
        </div>

        <div class="col-12 col-md-5">
          <label class="form-label fw-semibold">Fecha <span class="text-danger">*</span></label>
          <input type="date" class="form-control" [(ngModel)]="orden.fecOrden"
                 [max]="hoy" (ngModelChange)="limpiarAviso()">
        </div>

        <div class="col-6 col-md-4">
          <label class="form-label fw-semibold">Moneda <span class="text-danger">*</span></label>
          <select class="form-select" [(ngModel)]="orden.codMoneda" (ngModelChange)="limpiarAviso()">
            <option value="MN">Soles</option>
            <option value="US">Dólares</option>
          </select>
        </div>

        <div class="col-6 col-md-8">
          <label class="form-label fw-semibold">Importe entregado <span class="text-danger">*</span></label>
          <input type="number" class="form-control text-end" [(ngModel)]="orden.impOrdPago"
                 min="0" step="0.01" (ngModelChange)="limpiarAviso()">
        </div>

        <div class="col-12 col-md-6">
          <label class="form-label fw-semibold">Centro de costo</label>
          <input class="form-control" [(ngModel)]="orden.codCCostos" maxlength="20">
        </div>

        <div class="col-12 col-md-6">
          <label class="form-label fw-semibold">Tipo de gasto</label>
          <input class="form-control" [(ngModel)]="orden.codTipoGasto" maxlength="4"
                 placeholder="MOV, ALI, HOS...">
          <div class="form-text">Define a qué cuenta va el gasto en CONCAR.</div>
        </div>

        <div class="col-12">
          <label class="form-label fw-semibold">Glosa</label>
          <input class="form-control" [(ngModel)]="orden.glosa" maxlength="100"
                 placeholder="Para qué es la entrega">
          <div class="form-text">{{ (orden.glosa || '').length }} de 100</div>
        </div>

      </div>

      <!-- El periodo se deduce de la fecha. Se muestra para que quien lo
           necesite sepa que puede cambiarlo, sin obligar a nadie a llenarlo. -->
      <details class="mt-3">
        <summary class="small text-muted" style="cursor:pointer">Periodo contable</summary>
        <div class="row g-2 mt-1">
          <div class="col-6">
            <label class="form-label small">Año</label>
            <input class="form-control form-control-sm" [(ngModel)]="orden.anoPeriodo"
                   maxlength="4" [placeholder]="anioDeLaFecha">
          </div>
          <div class="col-6">
            <label class="form-label small">Mes</label>
            <input class="form-control form-control-sm" [(ngModel)]="orden.codPeriodo"
                   maxlength="2" [placeholder]="mesDeLaFecha">
          </div>
        </div>
        <div class="form-text">Si se dejan vacíos se toman de la fecha de la orden.</div>
      </details>

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button class="general-button btn-secondary" (click)="cerrar()">Cancelar</button>
      <button class="general-button btn-primary" [disabled]="!puedeGrabar()" (click)="grabar()">
        {{ esNueva ? 'Crear' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `
})
export class OrdenPagoDialogComponent {

  orden: OrdenPagoPropia;
  esNueva: boolean;
  reparos: string[];

  /** Tope del selector de fecha: una OP no puede ser del futuro. */
  readonly hoy = new Date().toISOString().slice(0, 10);

  constructor(
    private ref: MatDialogRef<OrdenPagoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OrdenPagoDialogData
  ) {
    this.esNueva = !data?.orden?.numOrden;
    this.reparos = data?.reparos ?? [];

    // Copia, no la referencia: si el usuario cancela, la fila de la grilla
    // tiene que quedar como estaba.
    this.orden = data?.orden
      ? { ...data.orden }
      : { codMoneda: 'MN', fecOrden: this.hoy };
  }

  get anioDeLaFecha(): string {
    return this.orden.fecOrden ? this.orden.fecOrden.slice(0, 4) : '';
  }

  get mesDeLaFecha(): string {
    return this.orden.fecOrden ? this.orden.fecOrden.slice(5, 7) : '';
  }

  /** Lo mínimo para que valga la pena ir al servidor. */
  puedeGrabar(): boolean {
    return !!(this.orden.codAuxiliar && this.orden.codAuxiliar.trim())
        && !!this.orden.fecOrden
        && !!this.orden.codMoneda
        && this.orden.impOrdPago != null
        && this.orden.impOrdPago > 0;
  }

  /** Los reparos del servidor dejan de tener sentido apenas se toca algo. */
  limpiarAviso(): void {
    this.reparos = [];
  }

  grabar(): void {
    this.ref.close(this.orden);
  }

  cerrar(): void {
    this.ref.close(null);
  }
}
