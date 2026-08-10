import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ResultadoEnvioCredencial {
  userId: number;
  nombreCompleto: string;
  usuario: string;
  correo: string;
  enviado: boolean;
  contrasenaCambiada: boolean;
  detalle: string;
}

/**
 * Muestra el resultado del envio fila por fila.
 *
 * Un resumen del tipo "se enviaron 18 de 20" no sirve: lo que hace falta es
 * saber CUALES fallaron y por que, porque cada uno se arregla distinto.
 */
@Component({
  selector: 'app-resultado-credenciales-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>
      <i class="fa-solid fa-list-check me-2" style="color: var(--primary-color);"></i>
      Resultado del envio
    </h2>

    <mat-dialog-content>

      <div class="d-flex gap-3 mb-3 small">
        <span class="badge bg-success">Enviados: {{ enviados }}</span>
        <span class="badge bg-danger" *ngIf="fallidos > 0">Sin enviar: {{ fallidos }}</span>
      </div>

      <div class="table-responsive" style="max-height: 45vh;">
        <table class="table table-sm table-striped align-middle">
          <thead>
            <tr>
              <th></th>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of data">
              <td class="text-center">
                <i class="fa-solid"
                   [class.fa-circle-check]="r.enviado"
                   [class.text-success]="r.enviado"
                   [class.fa-circle-xmark]="!r.enviado"
                   [class.text-danger]="!r.enviado"></i>
              </td>
              <td>{{ r.usuario }}</td>
              <td>{{ r.nombreCompleto }}</td>
              <td class="small">{{ r.correo || '-' }}</td>
              <td class="small" [class.text-danger]="!r.enviado">{{ r.detalle }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button class="general-button btn-primary" type="button" (click)="dialogRef.close()">
        Cerrar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: 640px; }
    mat-dialog-content { padding-top: 8px !important; }
  `],
})
export class ResultadoCredencialesDialogComponent {

  constructor(
    public dialogRef: MatDialogRef<ResultadoCredencialesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ResultadoEnvioCredencial[],
  ) {}

  get enviados(): number {
    return (this.data || []).filter(r => r.enviado).length;
  }

  get fallidos(): number {
    return (this.data || []).filter(r => !r.enviado).length;
  }
}
