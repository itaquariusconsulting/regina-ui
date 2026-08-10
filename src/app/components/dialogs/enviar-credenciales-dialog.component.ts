import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface EnviarCredencialesDialogData {
  /** Cuantos usuarios se seleccionaron. */
  cantidad: number;
  /** Cuantos de esos no tienen correo cargado. */
  sinCorreo: number;
  /** Correo del administrador, para proponerlo como destino de prueba. */
  correoAdmin?: string;
}

export interface EnviarCredencialesDialogResult {
  modoContrasena: 'ALEATORIA' | 'FIJA';
  contrasenaFija?: string;
  correoDePrueba?: string;
}

/**
 * Pregunta como se generan las contrasenas antes de mandar nada.
 *
 * El envio de prueba esta arriba y separado a proposito: es la unica opcion
 * que no toca la base. Todo lo demas cambia la contrasena de gente real.
 */
@Component({
  selector: 'app-enviar-credenciales-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>
      <i class="fa-solid fa-paper-plane me-2" style="color: var(--primary-color);"></i>
      Enviar credenciales
    </h2>

    <mat-dialog-content>

      <p class="text-muted small mb-3">
        Se enviara el correo con las credenciales a
        <strong>{{ data.cantidad }}</strong> usuario(s).
      </p>

      <div *ngIf="data.sinCorreo > 0" class="alert alert-warning py-2 px-3 small">
        <i class="fa-solid fa-triangle-exclamation me-1"></i>
        <strong>{{ data.sinCorreo }}</strong> de los seleccionados no tiene correo
        registrado. A esos no se les cambiara la contrasena ni se les enviara nada.
      </div>

      <!-- Prueba -->
      <div class="form-check mb-2">
        <input class="form-check-input" type="checkbox" id="chkPrueba"
               [(ngModel)]="esPrueba" (change)="validar()" />
        <label class="form-check-label fw-semibold" for="chkPrueba">
          Solo enviarme una prueba a mi
        </label>
      </div>

      <div *ngIf="esPrueba" class="mb-3 ps-4">
        <input type="email" class="form-control general-input"
               placeholder="correo@aquariusconsulting.com.pe"
               [(ngModel)]="correoDePrueba" (input)="validar()" maxlength="150" />
        <small class="text-muted d-block mt-1">
          Todos los correos van a esta direccion y
          <strong>no se cambia ninguna contrasena</strong>.
        </small>
      </div>

      <hr *ngIf="!esPrueba" class="my-3" />

      <!-- Contrasena -->
      <div *ngIf="!esPrueba">
        <label class="form-label fw-semibold">Contrasena que se envia</label>

        <div class="form-check">
          <input class="form-check-input" type="radio" id="rbAleatoria" value="ALEATORIA"
                 [(ngModel)]="modo" (change)="validar()" name="modoContrasena" />
          <label class="form-check-label" for="rbAleatoria">
            Una distinta para cada persona
            <small class="text-muted d-block">
              Recomendado. Nadie mas la conoce, ni siquiera queda escrita en el sistema.
            </small>
          </label>
        </div>

        <div class="form-check mt-2">
          <input class="form-check-input" type="radio" id="rbFija" value="FIJA"
                 [(ngModel)]="modo" (change)="validar()" name="modoContrasena" />
          <label class="form-check-label" for="rbFija">
            La misma para todos
            <small class="text-muted d-block">
              Comoda para una carga inicial, pero cualquiera que la conozca entra a
              las cuentas que no la hayan cambiado.
            </small>
          </label>
        </div>

        <div *ngIf="modo === 'FIJA'" class="mt-2 ps-4">
          <input type="text" class="form-control general-input"
                 [(ngModel)]="contrasenaFija" (input)="validar()" maxlength="60"
                 placeholder="Minimo 6 caracteres" />
        </div>

        <div class="alert alert-danger py-2 px-3 small mt-3 mb-0">
          <i class="fa-solid fa-circle-exclamation me-1"></i>
          Al confirmar se <strong>cambia la contrasena actual</strong> de esas personas.
          Las que tengan una en uso dejaran de poder entrar con ella.
        </div>
      </div>

      <small *ngIf="error" class="text-danger d-block mt-2">
        <i class="fa-solid fa-circle-exclamation me-1"></i>{{ error }}
      </small>

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button class="general-button btn-secondary me-2" type="button" (click)="cancelar()">
        Cancelar
      </button>
      <button class="general-button btn-primary" type="button"
              [disabled]="!puedeEnviar" (click)="confirmar()">
        <i class="fa-solid fa-paper-plane me-1"></i>
        {{ esPrueba ? 'Enviar prueba' : 'Enviar credenciales' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display: block; min-width: 420px; max-width: 520px; }
    mat-dialog-content { padding-top: 8px !important; }
    .form-label { font-size: 0.85rem; }
  `],
})
export class EnviarCredencialesDialogComponent {

  modo: 'ALEATORIA' | 'FIJA' = 'ALEATORIA';
  contrasenaFija = '';
  esPrueba = false;
  correoDePrueba = '';
  error = '';
  puedeEnviar = true;

  constructor(
    public dialogRef: MatDialogRef<EnviarCredencialesDialogComponent, EnviarCredencialesDialogResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: EnviarCredencialesDialogData,
  ) {
    this.correoDePrueba = data.correoAdmin || '';
  }

  validar(): void {
    this.error = '';

    if (this.esPrueba) {
      const correo = (this.correoDePrueba || '').trim();
      if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        this.error = 'Escribe un correo valido para la prueba.';
        this.puedeEnviar = false;
        return;
      }
      this.puedeEnviar = true;
      return;
    }

    if (this.modo === 'FIJA' && (this.contrasenaFija || '').trim().length < 6) {
      this.error = 'La contrasena fija debe tener al menos 6 caracteres.';
      this.puedeEnviar = false;
      return;
    }

    this.puedeEnviar = true;
  }

  confirmar(): void {
    if (!this.puedeEnviar) { return; }

    this.dialogRef.close({
      modoContrasena: this.esPrueba ? 'ALEATORIA' : this.modo,
      contrasenaFija: this.modo === 'FIJA' ? this.contrasenaFija.trim() : undefined,
      correoDePrueba: this.esPrueba ? this.correoDePrueba.trim() : undefined,
    });
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
