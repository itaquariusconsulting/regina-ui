import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { EstablecimientoAnexo } from '../../models/establecimiento-anexo';

/**
 * Datos que recibe el modal: lista de anexos + (opcional) selección previa.
 */
export interface AnexoSelectorData {
  ruc: string;
  razonSocial?: string;
  anexos: EstablecimientoAnexo[];
  seleccionPrevia?: EstablecimientoAnexo | null;
}

/**
 * Modal para seleccionar un Establecimiento Anexo desde la lista publicada
 * por SUNAT. Soporta:
 *   - Búsqueda libre (semántica simple: tokeniza y matchea todos los términos
 *     contra los campos del anexo).
 *   - Paginación (10/25/50/100 por página).
 *   - Vista de JSON completo expandible por fila.
 *   - Selección obligatoria para cerrar con "Confirmar".
 *
 * Es standalone Angular 19, con MatDialogModule + FormsModule.
 */
@Component({
  selector: 'app-anexo-selector-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <div class="anex-dialog">
      <div class="anex-header">
        <div>
          <h4 class="m-0">Establecimientos del RUC {{ data.ruc }}</h4>
          <small class="text-muted">{{ data.razonSocial || '' }} — {{ (data.anexos || []).length }} establecimiento(s) disponibles</small>
        </div>
        <button type="button" class="btn-cerrar" (click)="cancelar()" title="Cerrar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="anex-search">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text"
               class="form-control"
               placeholder="Buscar por dirección, distrito, código o tipo… (ej: 'plaza vea surco')"
               [(ngModel)]="textoBusqueda"
               (ngModelChange)="onBusquedaChange()"
               autocomplete="off">
        <button *ngIf="textoBusqueda" type="button" class="btn-limpiar" (click)="limpiarBusqueda()" title="Limpiar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="anex-toolbar">
        <span class="text-muted">
          Mostrando {{ inicioActual + 1 }}-{{ finActual }} de {{ filtrados.length }}
        </span>
        <div class="d-flex align-items-center gap-2">
          <label class="m-0 text-muted">Filas:</label>
          <select [(ngModel)]="pageSize" (change)="onPageSizeChange()" class="form-select form-select-sm">
            <option [ngValue]="10">10</option>
            <option [ngValue]="25">25</option>
            <option [ngValue]="50">50</option>
            <option [ngValue]="100">100</option>
          </select>
        </div>
      </div>

      <div class="anex-list">
        <div *ngIf="filtrados.length === 0" class="text-center text-muted p-4">
          <i class="fa-solid fa-magnifying-glass fa-2x mb-2 d-block"></i>
          No se encontraron establecimientos con esa búsqueda.
        </div>

        <div *ngFor="let anexo of paginados; trackBy: trackByCodigo"
             class="anex-row"
             [class.selected]="seleccionado?.codigo === anexo.codigo"
             (click)="seleccionar(anexo)">
          <div class="anex-row-main">
            <div class="anex-codigo">
              <span class="badge-codigo">{{ anexo.codigo || '----' }}</span>
              <span class="anex-tipo">{{ anexo.tipo || 'SIN TIPO' }}</span>
            </div>
            <div class="anex-direccion">
              <strong>{{ anexo.direccion }}</strong>
              <small class="text-muted">
                {{ [anexo.departamento, anexo.provincia, anexo.distrito] | json }}
              </small>
            </div>
            <button type="button" class="btn-json" (click)="$event.stopPropagation(); toggleJson(anexo)"
                    title="Ver JSON completo">
              <i class="fa-solid" [class.fa-chevron-down]="!expandido[anexo.codigo!]" [class.fa-chevron-up]="expandido[anexo.codigo!]"></i>
              JSON
            </button>
          </div>

          <pre *ngIf="expandido[anexo.codigo!]" class="anex-json">{{ anexo | json }}</pre>
        </div>
      </div>

      <div class="anex-paginacion" *ngIf="totalPaginas > 1">
        <button type="button" class="btn-pag" (click)="irPagina(1)" [disabled]="paginaActual === 1">
          <i class="fa-solid fa-angles-left"></i>
        </button>
        <button type="button" class="btn-pag" (click)="irPagina(paginaActual - 1)" [disabled]="paginaActual === 1">
          <i class="fa-solid fa-angle-left"></i>
        </button>
        <span class="pag-info">Página {{ paginaActual }} de {{ totalPaginas }}</span>
        <button type="button" class="btn-pag" (click)="irPagina(paginaActual + 1)" [disabled]="paginaActual === totalPaginas">
          <i class="fa-solid fa-angle-right"></i>
        </button>
        <button type="button" class="btn-pag" (click)="irPagina(totalPaginas)" [disabled]="paginaActual === totalPaginas">
          <i class="fa-solid fa-angles-right"></i>
        </button>
      </div>

      <div class="anex-footer">
        <div class="seleccion-info">
          <ng-container *ngIf="seleccionado; else sinSel">
            <i class="fa-solid fa-circle-check text-success me-1"></i>
            <strong>Seleccionado:</strong> {{ seleccionado.codigo }} — {{ seleccionado.direccion }}
          </ng-container>
          <ng-template #sinSel>
            <i class="fa-solid fa-circle-exclamation text-warning me-1"></i>
            <span class="text-muted">Seleccione un establecimiento de la lista.</span>
          </ng-template>
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-secondary" (click)="cancelar()">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="confirmar()" [disabled]="!seleccionado">
            <i class="fa-solid fa-check me-1"></i> Confirmar selección
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .anex-dialog {
      display: flex;
      flex-direction: column;
      width: 920px;
      max-width: 95vw;
      max-height: 85vh;
      font-family: var(--app-font-family, Arial);
    }
    .anex-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e9ecef;
      background: #f8f9fa;
    }
    .anex-header h4 { font-size: 1.1rem; font-weight: 700; color: #1f3864; }
    .btn-cerrar {
      background: transparent;
      border: none;
      font-size: 1.4rem;
      color: #6c757d;
      cursor: pointer;
      padding: 4px 10px;
    }
    .btn-cerrar:hover { color: #dc3545; }

    .anex-search {
      position: relative;
      padding: 12px 20px;
      border-bottom: 1px solid #e9ecef;
    }
    .anex-search .fa-magnifying-glass {
      position: absolute;
      left: 32px;
      top: 50%;
      transform: translateY(-50%);
      color: #adb5bd;
    }
    .anex-search input {
      padding-left: 34px;
      padding-right: 34px;
      font-size: 0.95rem;
      width: 100%;
      border: 1px solid #ced4da;
      border-radius: 6px;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .btn-limpiar {
      position: absolute;
      right: 32px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: #adb5bd;
      cursor: pointer;
    }

    .anex-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 20px;
      background: #f8f9fa;
      font-size: 0.85rem;
      border-bottom: 1px solid #e9ecef;
    }
    .anex-toolbar select { width: 70px; font-size: 0.85rem; }

    .anex-list {
      flex: 1;
      overflow-y: auto;
      padding: 0 8px;
      min-height: 250px;
      max-height: 50vh;
    }

    .anex-row {
      padding: 10px 12px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: background 0.15s;
    }
    .anex-row:hover { background: #eef5ff; }
    .anex-row.selected {
      background: #d1e9c8 !important;
      border-left: 4px solid #28a745;
    }

    .anex-row-main {
      display: grid;
      grid-template-columns: 180px 1fr auto;
      gap: 12px;
      align-items: center;
    }
    .anex-codigo { display: flex; flex-direction: column; gap: 4px; }
    .badge-codigo {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: #1f3864;
      color: white;
      font-size: 0.85rem;
      font-weight: 700;
      width: fit-content;
    }
    .anex-tipo {
      font-size: 0.78rem;
      color: #6c757d;
      text-transform: uppercase;
    }
    .anex-direccion { display: flex; flex-direction: column; gap: 2px; line-height: 1.3; }
    .anex-direccion strong { font-size: 0.92rem; color: #212529; }
    .anex-direccion small { font-size: 0.75rem; }
    .btn-json {
      background: transparent;
      border: 1px solid #ced4da;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 0.78rem;
      color: #6c757d;
      cursor: pointer;
    }
    .btn-json:hover { background: #1f3864; color: white; border-color: #1f3864; }

    .anex-json {
      margin: 8px 0 0 0;
      padding: 10px;
      background: #2b3035;
      color: #f8f9fa;
      border-radius: 6px;
      font-size: 0.78rem;
      max-height: 200px;
      overflow: auto;
      font-family: 'Consolas', monospace;
    }

    .anex-paginacion {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      padding: 10px;
      border-top: 1px solid #e9ecef;
      background: #f8f9fa;
    }
    .btn-pag {
      background: white;
      border: 1px solid #ced4da;
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
      color: #1f3864;
    }
    .btn-pag:hover:not(:disabled) { background: #1f3864; color: white; }
    .btn-pag:disabled { opacity: 0.4; cursor: not-allowed; }
    .pag-info { padding: 0 12px; font-size: 0.85rem; color: #6c757d; }

    .anex-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      border-top: 1px solid #e9ecef;
      background: #f8f9fa;
    }
    .seleccion-info { font-size: 0.88rem; color: #212529; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .anex-footer button { min-width: 100px; }
  `]
})
export class AnexoSelectorDialogComponent implements OnInit {

  textoBusqueda = '';
  filtrados: EstablecimientoAnexo[] = [];
  paginados: EstablecimientoAnexo[] = [];
  expandido: { [codigo: string]: boolean } = {};

  pageSize = 25;
  paginaActual = 1;
  totalPaginas = 1;
  inicioActual = 0;
  finActual = 0;

  seleccionado: EstablecimientoAnexo | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AnexoSelectorData,
    private dialogRef: MatDialogRef<AnexoSelectorDialogComponent>
  ) {}

  ngOnInit(): void {
    this.seleccionado = this.data.seleccionPrevia || null;

    // Deduplicar defensivamente: si llegan repetidos desde el backend
    // o desde el caché del frontend, los descartamos.
    // Clave de dedupe: codigo|tipo|direccion (normalizado).
    const fuente = this.data.anexos || [];
    const vistos = new Set<string>();
    const unicos: EstablecimientoAnexo[] = [];
    for (const a of fuente) {
      const key = this.normalize(
        `${a.codigo || ''}|${a.tipo || ''}|${a.direccion || ''}`
      );
      if (key && !vistos.has(key)) {
        vistos.add(key);
        unicos.push(a);
      }
    }
    // Reescribimos la lista del dato de entrada para que la búsqueda
    // posterior trabaje sobre la versión sin duplicados.
    this.data.anexos = unicos;
    this.filtrados = unicos;
    this.actualizarPaginacion();
  }

  /**
   * Búsqueda "semántica simple": tokeniza el texto y exige que TODOS los
   * tokens aparezcan en alguno de los campos del anexo (case + tildes
   * tolerantes). Por ejemplo "plaza vea surco" → busca anexos cuyo
   * conjunto de campos contenga "plaza", "vea" y "surco".
   */
  onBusquedaChange(): void {
    const q = (this.textoBusqueda || '').trim();
    if (!q) {
      this.filtrados = this.data.anexos || [];
    } else {
      const tokens = this.normalize(q).split(/\s+/).filter(t => t.length > 0);
      this.filtrados = (this.data.anexos || []).filter(a => {
        const hay = this.normalize([
          a.codigo, a.tipo, a.direccion, a.departamento,
          a.provincia, a.distrito, a.actividadEconomica
        ].filter(Boolean).join(' '));
        return tokens.every(t => hay.includes(t));
      });
    }
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  limpiarBusqueda(): void {
    this.textoBusqueda = '';
    this.onBusquedaChange();
  }

  onPageSizeChange(): void {
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  irPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas) return;
    this.paginaActual = n;
    this.actualizarPaginacion();
  }

  private actualizarPaginacion(): void {
    this.totalPaginas = Math.max(1, Math.ceil(this.filtrados.length / this.pageSize));
    this.inicioActual = (this.paginaActual - 1) * this.pageSize;
    this.finActual = Math.min(this.inicioActual + this.pageSize, this.filtrados.length);
    this.paginados = this.filtrados.slice(this.inicioActual, this.finActual);
  }

  toggleJson(anexo: EstablecimientoAnexo): void {
    const k = anexo.codigo || '';
    this.expandido[k] = !this.expandido[k];
  }

  seleccionar(anexo: EstablecimientoAnexo): void {
    this.seleccionado = anexo;
  }

  trackByCodigo(_i: number, a: EstablecimientoAnexo): string {
    return a.codigo || a.direccion || String(_i);
  }

  confirmar(): void {
    if (!this.seleccionado) return;
    this.dialogRef.close(this.seleccionado);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }

  private normalize(s: string): string {
    return (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}
