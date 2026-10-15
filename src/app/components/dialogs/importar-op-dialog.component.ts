import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import Swal from 'sweetalert2';

import { OrdenPagoPropiaService } from '../../services/orden-pago-propia.service';
import { Response } from '../../models/response';
import {
  FilaImportada, ObservacionImportacion, ResultadoImportacion
} from '../../models/importacion-op';

export interface ImportarOpDialogData {
  codEmpresa: string;
  codSucursal: string;
  userId?: number;
}

/**
 * Carga masiva de órdenes de pago desde un Excel.
 *
 * Dos pasos obligatorios: revisar y recién después confirmar. No hay un camino
 * de un solo clic a propósito. Una carga masiva que entra a medias es el peor
 * resultado posible —nadie sabe qué quedó adentro y reintentar duplica—, así
 * que el usuario tiene que ver antes qué va a pasar.
 *
 * Al revisar se muestran dos cosas distintas y conviene no confundirlas:
 * las OBSERVACIONES son lo que hay que corregir, y la VISTA PREVIA es lo que
 * el sistema entendió de cada fila. La segunda importa tanto como la primera:
 * un importe mal interpretado no genera ningún error, entra callado.
 */
@Component({
  selector: 'app-importar-op-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>
      <i class="fa-solid fa-file-excel" style="color: var(--primary-color);"></i>
      <span class="ms-2">Importar órdenes de pago</span>
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
                 accept=".xlsx,.xls" (change)="elegir($event)" [disabled]="trabajando">

          <div class="form-text">
            Excel con una fila por orden. Si no tiene el formato a mano, baje la plantilla.
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
              {{ resultado.filasConError }} fila(s) con error. No se va a cargar ninguna orden.
            </ng-container>
            <ng-container *ngIf="!hayErrores && resultado.filasValidas">
              {{ resultado.filasValidas }} orden(es) listas para cargar.
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
                  <th style="width:140px;">Columna</th>
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
          <div class="table-responsive" style="max-height: 280px; overflow:auto;">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Orden</th>
                  <th>Fecha</th>
                  <th>Persona</th>
                  <th>Glosa</th>
                  <th class="text-end">Importe</th>
                  <th>C. costo</th>
                  <th>Tipo gasto</th>
                  <th>Periodo</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let f of filasConDatos" [class.table-danger]="f.conError">
                  <td class="small text-muted">{{ f.fila }}</td>
                  <td class="small">
                    <span *ngIf="f.op?.numOrden">{{ f.op?.numOrden }}</span>
                    <span *ngIf="!f.op?.numOrden" class="text-muted fst-italic">lo asigna el sistema</span>
                  </td>
                  <td class="small">{{ f.op?.fecOrden || marcar(f.crudoFecha) }}</td>
                  <td class="small">{{ f.op?.codAuxiliar || marcar(f.crudoPersona) }}</td>
                  <td class="small">{{ f.op?.glosa || '—' }}</td>
                  <td class="small text-end">
                    {{ f.op?.codMoneda === '02' ? 'US$' : 'S/' }}
                    {{ f.op?.impOrdPago != null
                        ? (f.op?.impOrdPago | number:'1.2-2')
                        : marcar(f.crudoImporte) }}
                  </td>
                  <td class="small">{{ f.op?.codCCostos || '—' }}</td>
                  <td class="small">{{ f.op?.codTipoGasto || '—' }}</td>
                  <td class="small">{{ f.op?.codPeriodo }}-{{ f.op?.anoPeriodo }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="form-text">
            Compare el importe y la fecha contra su archivo antes de confirmar.
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
        {{ trabajando ? 'Cargando…' : 'Cargar ' + resultado.filasValidas + ' orden(es)' }}
      </button>
    </mat-dialog-actions>
  `
})
export class ImportarOpDialogComponent {

  archivo: File | null = null;
  resultado: ResultadoImportacion | null = null;
  trabajando = false;

  constructor(
    private ref: MatDialogRef<ImportarOpDialogComponent>,
    private servicio: OrdenPagoPropiaService,
    @Inject(MAT_DIALOG_DATA) public data: ImportarOpDialogData
  ) {}

  /* --------------------------------------------------------------- estado */

  get hayErrores(): boolean {
    return !!this.resultado?.observaciones?.some(
      (o: ObservacionImportacion) => o.nivel === 'ERROR');
  }

  /** Las filas que el sistema consideró órdenes. Las vacías no se muestran. */
  get filasConDatos(): FilaImportada[] {
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
        a.download = 'plantilla-ordenes-de-pago.xlsx';
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

    this.servicio.importarRevisar(this.data.codEmpresa, this.data.codSucursal, this.archivo)
      .subscribe({
        next: (r: Response) => {
          this.trabajando = false;
          this.resultado = r?.resultado as ResultadoImportacion;
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

    this.servicio.importarConfirmar(
      this.data.codEmpresa, this.data.codSucursal, this.archivo, this.data.userId)
      .subscribe({
        next: (r: Response) => {
          this.trabajando = false;
          const res = r?.resultado as ResultadoImportacion;
          Swal.fire('Órdenes cargadas',
            (res?.creadas?.length ?? 0) + ' orden(es) de pago quedaron registradas.', 'success');
          this.ref.close(true);
        },
        error: (err) => {
          this.trabajando = false;
          /* 422: el servidor volvió a leer el archivo y encontró algo. Se
             muestra el detalle nuevo en vez del de la revisión, que puede ser
             de hace rato. */
          const detalle = this.servicio.resultadoDe(err) as ResultadoImportacion | null;
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
