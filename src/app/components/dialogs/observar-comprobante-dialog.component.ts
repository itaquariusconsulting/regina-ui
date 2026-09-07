import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

/** Un motivo del catalogo REG_REND_MOTIVO. */
export interface MotivoObservacion {
  codMotivo: string;
  desMotivo: string;
  ambito?: string;
  orden?: number;
}

export interface ObservarDialogData {
  /** Que se esta observando, para que quede claro sobre que se decide. */
  descripcion: string;
  motivos: MotivoObservacion[];
  /** Minimo de caracteres del comentario. */
  minimoComentario?: number;
}

export interface ObservarDialogResult {
  codMotivo: string;
  motivo: string;
}

/**
 * El dialogo con el que contabilidad observa un comprobante.
 *
 * <p>Reemplaza dos SweetAlert encadenados —primero un select con los motivos,
 * despues otro popup para el detalle— por una sola pantalla. Encadenarlos
 * obligaba a decidir el motivo sin ver todavia que habia que escribir, y no
 * dejaba volver atras sin cancelar todo.
 *
 * <p>Los motivos van como lista y no como desplegable a proposito: son pocos
 * y conviene verlos todos a la vez, porque elegir bien el motivo es lo que
 * hace util el reporte de "principales motivos".
 *
 * <p>El comentario es obligatorio. Antes solo se exigia con el motivo OTRO, y
 * el resultado era que el trabajador recibia una etiqueta suelta —"Falta
 * firma"— sin saber en que comprobante ni que hacer.
 */
@Component({
  selector: 'app-observar-comprobante-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  styleUrls: ['./observar-comprobante-dialog.component.scss'],
  template: `
    <div class="obs-header">
        <i class="fa-solid fa-flag"></i>
        <div>
            <h4 class="h4 mb-0" mat-dialog-title>Observar comprobante</h4>
            <span class="obs-sub">{{ data.descripcion }}</span>
        </div>
    </div>

    <mat-dialog-content class="obs-content">

        <p class="obs-nota">
            El comprobante queda marcado como que no sustenta. El asiento en
            contabilidad no se toca.
        </p>

        <label class="obs-label">Motivo</label>
        <div class="obs-motivos">
            <button type="button"
                    class="obs-motivo"
                    *ngFor="let m of data.motivos"
                    [class.activo]="codMotivo === m.codMotivo"
                    (click)="elegir(m.codMotivo)">
                <i class="fa-regular"
                   [class.fa-circle-dot]="codMotivo === m.codMotivo"
                   [class.fa-circle]="codMotivo !== m.codMotivo"></i>
                <span>{{ m.desMotivo }}</span>
            </button>

            <div class="obs-vacio" *ngIf="!data.motivos?.length">
                No se pudieron cargar los motivos. Cierre y vuelva a intentar.
            </div>
        </div>

        <label class="obs-label">
            Comentario
            <small>lo que el trabajador necesita leer para corregir</small>
        </label>
        <textarea class="form-control obs-texto"
                  rows="3"
                  maxlength="500"
                  [(ngModel)]="comentario"
                  (ngModelChange)="tocado = true"
                  placeholder="Ej.: el comprobante no tiene firma del responsable en la segunda hoja"></textarea>

        <div class="obs-pie">
            <span class="obs-error" *ngIf="tocado && !comentarioValido">
                Escriba al menos {{ minimo }} caracteres.
            </span>
            <span class="obs-contador">{{ comentario.length }}/500</span>
        </div>

    </mat-dialog-content>

    <mat-dialog-actions class="d-flex justify-content-end gap-2">
        <button mat-button class="general-button btn-danger" (click)="cancelar()">
            Cancelar
        </button>
        <button mat-button class="general-button btn-primary"
                [disabled]="!puedeObservar"
                (click)="confirmar()">
            Observar
        </button>
    </mat-dialog-actions>
  `
})
export class ObservarComprobanteDialogComponent {

  codMotivo = '';
  comentario = '';
  tocado = false;

  constructor(
    private ref: MatDialogRef<ObservarComprobanteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ObservarDialogData
  ) {}

  get minimo(): number {
    return this.data?.minimoComentario ?? 5;
  }

  get comentarioValido(): boolean {
    return this.comentario.trim().length >= this.minimo;
  }

  get puedeObservar(): boolean {
    return !!this.codMotivo && this.comentarioValido;
  }

  elegir(cod: string): void {
    this.codMotivo = cod;
  }

  cancelar(): void {
    this.ref.close();
  }

  confirmar(): void {
    // El boton ya esta deshabilitado, pero la comprobacion se repite: un
    // Enter o un clic disparado por script no pasan por el disabled.
    if (!this.puedeObservar) {
      this.tocado = true;
      return;
    }
    this.ref.close({
      codMotivo: this.codMotivo,
      motivo: this.comentario.trim()
    } as ObservarDialogResult);
  }
}
