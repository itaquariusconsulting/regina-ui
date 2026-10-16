import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import Swal from 'sweetalert2';

import { AnexoService } from '../../services/anexo.service';
import { Response } from '../../models/response';
import { ObservacionImportacion } from '../../models/importacion-op';
import { FilaAnexo, ResultadoAnexos } from '../../models/importacion-anexo';

export interface ImportarAnexosDialogData {
  codEmpresa: string;
  usuario?: string;
}

@Component({
  selector: 'app-importar-anexos-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>
      <i class="fa-solid fa-address-book" style="color: var(--primary-color);"></i>
      <span class="ms-2">Importar anexos</span>
    </h2>

    <mat-dialog-content>

      <!-- ============================ PASO 1: el archivo ============================ -->
      <div class="card mb-3">
        <div class="card-body py-3">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <span class="fw-semibold small">1. Elija el archivo</span>
            <button class="general-button btn-secondary btn-sm" type="button"
                    (click)="bajarPlantilla()" [disabled]="trabajando">
              <i class="fa fa-download"></i> Descargar plantilla
            </button>
          </div>

          <input type="file" class="form-control form-control-sm"
                 accept=".xlsx,.xls,.csv,.txt" (change)="elegir($event)" [disabled]="trabajando">

          <div class="form-text">
            Excel del CONCAR o archivo de texto separado por punto y coma, tabulación,
            barra o coma. Una fila por anexo, con los títulos en la primera línea.
          </div>

          <div class="mt-2" *ngIf="archivo">
            <button class="general-button btn-primary btn-sm" type="button"
                    (click)="revisar()" [disabled]="trabajando">
              <i class="fa fa-magnifying-glass"></i>
              {{ trabajando && !resultado ? 'Revisando…' : 'Revisar el archivo' }}
            </button>
            <span class="ms-2 small text-muted">No graba nada todavía.</span>
          </div>
        </div>
      </div>

      <!-- ============================ PASO 2: lo que pasaría ======================== -->
      <ng-container *ngIf="resultado">

        <div class="alert py-2 px-3"
             [ngClass]="hayErrores ? 'alert-danger' : (resultado.filasValidas ? 'alert-success' : 'alert-warning')">
          <div class="fw-semibold">
            <ng-container *ngIf="hayErrores">
              {{ resultado.filasConError }} fila(s) con error. No se va a cargar ningún anexo.
            </ng-container>
            <ng-container *ngIf="!hayErrores && resultado.filasValidas">
              {{ resultado.creados.length }} anexo(s) nuevos
              <span *ngIf="resultado.actualizados.length">
                y {{ resultado.actualizados.length }} que se van a actualizar</span>.
            </ng-container>
            <ng-container *ngIf="!hayErrores && !resultado.filasValidas">
              El archivo no tiene ninguna fila con datos.
            </ng-container>
          </div>
          <div class="small">
            Leído {{ resultado.modoLectura }} ·
            {{ resultado.filasLeidas }} fila(s) con datos ·
            {{ resultado.filasVacias }} ignorada(s).
          </div>
        </div>

        <!-- ------------------------------ observaciones ------------------------------ -->
        <div *ngIf="resultado.observaciones?.length" class="mb-3">
          <div class="fw-semibold small mb-1">Observaciones</div>
          <div class="table-responsive" style="max-height: 230px; overflow:auto;">
            <table class="table table-sm table-hover mb-0">
              <thead>
                <tr>
                  <th style="width:70px;">Fila</th>
                  <th style="width:150px;">Columna</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let o of resultado.observaciones"
                    [ngClass]="o.nivel === 'ERROR' ? 'table-danger' : 'table-warning'">
                  <td>{{ o.fila ? o.fila : '—' }}</td>
                  <td class="small">{{ o.columna || '—' }}</td>
                  <td class="small">{{ o.mensaje }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ------------------------------ vista previa ------------------------------ -->
        <div *ngIf="filasConDatos.length">
          <div class="fw-semibold small mb-1">
            Vista previa — así entendió el sistema cada fila
          </div>
          <div class="table-responsive" style="max-height: 300px; overflow:auto;">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Doc.</th>
                  <th>RUC</th>
                  <th>Tipo</th>
                  <th>Baja</th>
                  <th>Qué hace</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let f of filasConDatos" [class.table-danger]="f.conError">
                  <td class="small text-muted">{{ f.fila }}</td>
                  <td class="small">{{ f.auxiliar?.codAuxiliar || marcar(f.crudoCodigo) }}</td>
                  <td class="small">{{ f.auxiliar?.desAuxiliar || marcar(f.crudoNombre) }}</td>
                  <td class="small">
                    {{ f.auxiliar?.tipDocIdentidad || '—' }}
                    {{ f.auxiliar?.numDocIdentidad || '' }}
                  </td>
                  <td class="small">{{ f.auxiliar?.numRuc || '—' }}</td>
                  <td class="small">{{ f.auxiliar?.codTipoAuxi || '—' }}</td>
                  <td class="small">{{ f.auxiliar?.indBaja === 'S' ? 'Sí' : '' }}</td>
                  <td class="small">
                    <span *ngIf="f.conError" class="text-danger">no se carga</span>
                    <span *ngIf="!f.conError && f.yaExiste" class="text-warning-emphasis">
                      actualiza
                    </span>
                    <span *ngIf="!f.conError && !f.yaExiste" class="text-success">crea</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="form-text">
            Las filas que dicen <strong>actualiza</strong> pisan el nombre del anexo que ya
            está cargado. Las columnas que el archivo deje vacías conservan lo que tenían.
          </div>
        </div>

      </ng-container>

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button class="general-button btn-secondary" (click)="cerrar()" [disabled]="trabajando">
        Cancelar
      </button>
      <button class="general-button btn-primary"
              *ngIf="resultado && !hayErrores && resultado.filasValidas"
              (click)="confirmar()" [disabled]="trabajando">
        <i class="fa fa-upload"></i>
        {{ trabajando ? 'Cargando…' : 'Cargar ' + resultado.filasValidas + ' anexo(s)' }}
      </button>
    </mat-dialog-actions>
  `
})
export class ImportarAnexosDialogComponent {

  archivo: File | null = null;
  resultado: ResultadoAnexos | null = null;
  trabajando = false;

  constructor(
    private ref: MatDialogRef<ImportarAnexosDialogComponent>,
    private servicio: AnexoService,
    @Inject(MAT_DIALOG_DATA) public data: ImportarAnexosDialogData
  ) {}

  /* --------------------------------------------------------------- estado */

  get hayErrores(): boolean {
    return !!this.resultado?.observaciones?.some(
      (o: ObservacionImportacion) => o.nivel === 'ERROR');
  }

  /** Las filas que el sistema consideró anexos. Las vacías no se muestran. */
  get filasConDatos(): FilaAnexo[] {
    return (this.resultado?.filas ?? []).filter(f => !f.vacia);
  }

  /** Lo que decía la celda cuando no se pudo interpretar. */
  marcar(crudo?: string): string {
    const t = (crudo ?? '').trim();
    return t ? '«' + t + '»' : '—';
  }

  /* -------------------------------------------------------------- acciones */

  elegir(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.archivo = input.files && input.files.length ? input.files[0] : null;
    /* Cambiar de archivo invalida la revisión anterior. Dejarla en pantalla
       permitiría confirmar una carga mirando el resultado de otro archivo. */
    this.resultado = null;
  }

  bajarPlantilla(): void {
    this.trabajando = true;
    this.servicio.descargarPlantilla().subscribe({
      next: (blob) => {
        this.trabajando = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla-anexos.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.trabajando = false;
        Swal.fire('No se pudo bajar la plantilla', 'Intente de nuevo en un momento.', 'error');
      }
    });
  }

  revisar(): void {
    if (!this.archivo) { return; }
    this.trabajando = true;
    this.resultado = null;

    this.servicio.revisar(this.data.codEmpresa, this.archivo).subscribe({
      next: (r: Response) => {
        this.trabajando = false;
        this.resultado = r?.resultado as ResultadoAnexos;
      },
      error: (err) => {
        this.trabajando = false;
        this.fallo(err, 'No se pudo revisar el archivo');
      }
    });
  }

  confirmar(): void {
    if (!this.archivo || !this.resultado) { return; }
    this.trabajando = true;

    this.servicio.confirmar(this.data.codEmpresa, this.archivo, this.data.usuario).subscribe({
      next: (r: Response) => {
        this.trabajando = false;
        const res = r?.resultado as ResultadoAnexos;
        Swal.fire('Anexos cargados',
          (res?.creados?.length ?? 0) + ' creado(s) y '
          + (res?.actualizados?.length ?? 0) + ' actualizado(s).', 'success');
        this.ref.close(true);
      },
      error: (err) => {
        this.trabajando = false;
        /* 422: el servidor volvió a leer el archivo y encontró algo. Se
           muestra el detalle nuevo en vez del de la revisión, que puede ser
           de hace rato. */
        const detalle = this.servicio.resultadoDe(err) as ResultadoAnexos | null;
        if (detalle) {
          this.resultado = detalle;
          Swal.fire('No se cargó nada',
            'El archivo tiene observaciones. Revise el detalle.', 'warning');
          return;
        }
        this.fallo(err, 'No se pudo cargar el archivo');
      }
    });
  }

  cerrar(): void {
    this.ref.close(false);
  }

  private fallo(err: unknown, titulo: string): void {
    const e = err as { error?: Response };
    Swal.fire(titulo, e?.error?.mensaje ?? 'Intente de nuevo.', 'error');
  }
}
