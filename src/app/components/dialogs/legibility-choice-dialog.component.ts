import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

/**
 * Resultado que devuelve el dialog cuando el usuario elige una opción.
 *  - 'IMPROVE': el usuario quiere subir otra imagen (mejor calidad).
 *  - 'MANUAL':  el usuario aceptó registrar los campos manualmente.
 *  - 'CANCEL':  el usuario cerró sin elegir nada (se usa para limpiar estado).
 */
export type LegibilityChoice = 'IMPROVE' | 'MANUAL' | 'CANCEL';

@Component({
  selector: 'app-legibility-choice-dialog',
  imports: [MatDialogModule],
  styleUrls: ['./confirm-dialog.component.scss'],
  template: `
    <div class="dialog-header">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <h4 class="h4" mat-dialog-title>Documento no legible</h4>
    </div>

    <mat-dialog-content class="dialog-content">
      No se pudo leer correctamente la información del documento.
      <br />
      ¿Qué desea hacer?
    </mat-dialog-content>

    <mat-dialog-actions class="d-flex justify-content-end gap-2 flex-wrap">
      <button style="font-family: var(--app-font-family); font-size: 13px !important"
              mat-button
              class="general-button btn-danger"
              (click)="onCancel()">
        Cancelar
      </button>

      <button style="font-family: var(--app-font-family); font-size: 13px !important"
              mat-button
              class="general-button btn-secondary"
              (click)="onManual()">
        <i class="fa-solid fa-keyboard me-1"></i>
        Registrar manualmente
      </button>

      <button style="font-family: var(--app-font-family); font-size: 13px !important"
              mat-button
              class="general-button btn-primary"
              (click)="onImprove()">
        <i class="fa-solid fa-camera-rotate me-1"></i>
        Mejorar la imagen
      </button>
    </mat-dialog-actions>
  `,
})
export class LegibilityChoiceDialogComponent {
  constructor(public dialogRef: MatDialogRef<LegibilityChoiceDialogComponent, LegibilityChoice>) {}

  onImprove(): void {
    this.dialogRef.close('IMPROVE');
  }

  onManual(): void {
    this.dialogRef.close('MANUAL');
  }

  onCancel(): void {
    this.dialogRef.close('CANCEL');
  }
}
