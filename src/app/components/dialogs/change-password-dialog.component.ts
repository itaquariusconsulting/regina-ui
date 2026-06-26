import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

/**
 * Datos que recibe el diálogo:
 *  - `targetUsername` = username del usuario al que el admin le va a
 *    cambiar la contraseña. Se muestra en el título para que el admin
 *    confirme que está editando al usuario correcto.
 */
export interface ChangePasswordDialogData {
  targetUsername: string;
}

/**
 * Resultado que devuelve el diálogo:
 *  - `null` si el admin canceló.
 *  - `{ newPassword }` si el admin confirmó. La validación de coincidencia
 *    entre los dos campos se hace dentro del diálogo — el padre recibe
 *    la contraseña ya verificada.
 */
export interface ChangePasswordDialogResult {
  newPassword: string;
}

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>
      <i class="fa-solid fa-key me-2" style="color: var(--primary-color);"></i>
      Cambiar contraseña
    </h2>

    <mat-dialog-content>
      <p class="text-muted small mb-3">
        Estás cambiando la contraseña del usuario
        <strong>{{ data.targetUsername }}</strong>.
        El usuario debe iniciar sesión con esta nueva contraseña.
      </p>

      <div class="mb-2">
        <label class="form-label fw-semibold">Nueva contraseña</label>
        <div class="input-group">
          <input [type]="mostrarPassword ? 'text' : 'password'"
                 class="form-control general-input"
                 [(ngModel)]="newPassword"
                 (input)="validar()"
                 maxlength="60"
                 autocomplete="new-password" />
          <button class="btn btn-outline-secondary" type="button"
                  (click)="mostrarPassword = !mostrarPassword"
                  [title]="mostrarPassword ? 'Ocultar' : 'Mostrar'">
            <i class="fa-solid"
               [class.fa-eye]="!mostrarPassword"
               [class.fa-eye-slash]="mostrarPassword"></i>
          </button>
        </div>
      </div>

      <div class="mb-2">
        <label class="form-label fw-semibold">Confirmar contraseña</label>
        <input type="password"
               class="form-control general-input"
               [(ngModel)]="confirmPassword"
               (input)="validar()"
               maxlength="60"
               autocomplete="new-password" />
      </div>

      <!-- Mensaje de validación -->
      <small *ngIf="errorMsg" class="text-danger d-block">
        <i class="fa-solid fa-circle-exclamation me-1"></i>{{ errorMsg }}
      </small>
      <small *ngIf="!errorMsg && newPassword && confirmPassword" class="text-success d-block">
        <i class="fa-solid fa-circle-check me-1"></i>Las contraseñas coinciden.
      </small>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button class="general-button btn-secondary me-2" type="button" (click)="cancelar()">
        Cancelar
      </button>
      <button class="general-button btn-primary" type="button"
              [disabled]="!puedeGuardar"
              (click)="confirmar()">
        <i class="fa-solid fa-check me-1"></i>
        Cambiar
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: 340px; }
    mat-dialog-content { padding-top: 8px !important; }
    .form-label { font-size: 0.85rem; }
  `],
})
export class ChangePasswordDialogComponent {

  newPassword: string = '';
  confirmPassword: string = '';
  mostrarPassword: boolean = false;
  errorMsg: string = '';
  puedeGuardar: boolean = false;

  // Reglas mínimas — coinciden con el backend (ajustar si el back exige más).
  private static readonly MIN_LENGTH = 6;

  constructor(
    public dialogRef: MatDialogRef<ChangePasswordDialogComponent, ChangePasswordDialogResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: ChangePasswordDialogData,
  ) {}

  validar(): void {
    this.errorMsg = '';
    if (!this.newPassword) {
      this.puedeGuardar = false;
      return;
    }
    if (this.newPassword.length < ChangePasswordDialogComponent.MIN_LENGTH) {
      this.errorMsg = `La contraseña debe tener al menos ${ChangePasswordDialogComponent.MIN_LENGTH} caracteres.`;
      this.puedeGuardar = false;
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMsg = 'Las contraseñas no coinciden.';
      this.puedeGuardar = false;
      return;
    }
    this.puedeGuardar = true;
  }

  confirmar(): void {
    if (!this.puedeGuardar) return;
    this.dialogRef.close({ newPassword: this.newPassword });
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
