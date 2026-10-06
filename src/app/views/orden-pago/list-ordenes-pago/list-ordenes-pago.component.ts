import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import Swal from 'sweetalert2';

import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { OrdenPagoDialogComponent } from '../../../components/dialogs/orden-pago-dialog.component';
import { LoadingService } from '../../../services/loading.service';
import { OrdenPagoPropiaService } from '../../../services/orden-pago-propia.service';
import { FiltroOrdenPagoPropia, OrdenPagoPropia } from '../../../models/orden-pago-propia';

/**
 * Órdenes de pago por rendir, de RENDIX CONCAR.
 *
 * Es la pantalla que no existe en la versión de Aquarius: allá la OP viene del
 * ERP y acá nace en el sistema. Todo lo que pasa después —cargar comprobantes,
 * planillas, devoluciones, aprobar, exportar el asiento— ya funcionaba; esto
 * es la pieza que faltaba al principio del recorrido.
 */
@Component({
  selector: 'app-list-ordenes-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-ordenes-pago.component.html',
  styleUrls: ['./list-ordenes-pago.component.scss']
})
export class ListOrdenesPagoComponent implements OnInit {

  codEmpresa: string = sessionStorage.getItem('codempresa') ?? '';
  codSucursal: string = sessionStorage.getItem('codsucursal') ?? '001';

  ordenes: OrdenPagoPropia[] = [];
  cargando = false;
  guardando = false;

  filtro: FiltroOrdenPagoPropia = {};

  /** Para el combo de año: el actual y los dos anteriores. */
  anios: string[] = [];

  readonly meses = [
    { cod: '01', des: 'Enero' },     { cod: '02', des: 'Febrero' },
    { cod: '03', des: 'Marzo' },     { cod: '04', des: 'Abril' },
    { cod: '05', des: 'Mayo' },      { cod: '06', des: 'Junio' },
    { cod: '07', des: 'Julio' },     { cod: '08', des: 'Agosto' },
    { cod: '09', des: 'Setiembre' }, { cod: '10', des: 'Octubre' },
    { cod: '11', des: 'Noviembre' }, { cod: '12', des: 'Diciembre' }
  ];

  constructor(
    private servicio: OrdenPagoPropiaService,
    private loadingService: LoadingService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const hoy = new Date();
    for (let i = 0; i < 3; i++) { this.anios.push(String(hoy.getFullYear() - i)); }

    // Arranca en el periodo en curso, que es lo que casi siempre se quiere ver.
    this.filtro.anio = String(hoy.getFullYear());
    this.filtro.mes = String(hoy.getMonth() + 1).padStart(2, '0');

    this.buscar();
  }

  /* ------------------------------------------------------------- lectura */

  buscar(): void {
    this.cargando = true;
    this.servicio.listar(this.codEmpresa, this.codSucursal, this.filtro).subscribe({
      next: (r) => {
        this.ordenes = (r?.resultado ?? []) as OrdenPagoPropia[];
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.ordenes = [];
        // 409 es "falta el esquema" y el mensaje del servidor ya lo explica.
        Swal.fire('No se pudo buscar',
          err?.error?.mensaje ?? 'No se pudieron traer las órdenes de pago.', 'error');
      }
    });
  }

  limpiar(): void {
    this.filtro = {};
    this.buscar();
  }

  /* ------------------------------------------------------------ escritura */

  nueva(): void {
    this.abrirDialogo(undefined, []);
  }

  editar(op: OrdenPagoPropia): void {
    if (!op.editable) {
      Swal.fire('No se puede modificar', op.motivoNoEditable ?? '', 'info');
      return;
    }
    this.abrirDialogo(op, []);
  }

  /**
   * Abre el formulario y graba.
   *
   * Si el servidor rebota con reparos, se vuelve a abrir el mismo diálogo con
   * los datos que el usuario había escrito y la lista de qué corregir. Cerrar
   * y hacerle empezar de nuevo sería castigarlo por equivocarse.
   */
  private abrirDialogo(op: OrdenPagoPropia | undefined, reparos: string[]): void {
    this.dialog.open(OrdenPagoDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: { orden: op, reparos }
    }).afterClosed().subscribe((resultado: OrdenPagoPropia | null) => {
      if (!resultado) { return; }
      this.grabar(resultado);
    });
  }

  private grabar(op: OrdenPagoPropia): void {
    this.guardando = true;
    this.loadingService.show();

    const esNueva = !op.numOrden;
    const dto: OrdenPagoPropia = {
      ...op,
      codEmpresa: this.codEmpresa,
      codSucursal: this.codSucursal
    };

    const peticion = esNueva
      ? this.servicio.crear(dto, this.userId())
      : this.servicio.actualizar(dto);

    peticion.subscribe({
      next: (r) => {
        this.guardando = false;
        this.loadingService.hide();
        Swal.fire({ icon: 'success', title: r?.mensaje ?? 'Listo',
                    timer: 1800, showConfirmButton: false });
        this.buscar();
      },
      error: (err) => {
        this.guardando = false;
        this.loadingService.hide();

        const reparos = this.servicio.reparosDe(err);
        if (reparos.length) {
          // Se reabre con lo que había escrito y el detalle de qué corregir.
          this.abrirDialogo(op, reparos);
          return;
        }

        Swal.fire('No se pudo grabar',
          err?.error?.mensaje ?? 'No se pudo grabar la orden de pago.', 'error');
      }
    });
  }

  borrar(op: OrdenPagoPropia): void {
    if (!op.editable) {
      Swal.fire('No se puede borrar', op.motivoNoEditable ?? '', 'info');
      return;
    }

    this.dialog.open(ConfirmDialogComponent, {
      width: '320px',
      data: {
        title: 'Borrar orden de pago',
        message: `¿Borrar la orden ${op.numOrden} de ${op.codAuxiliar}, ` +
                 `por ${this.moneda(op)} ${(op.impOrdPago ?? 0).toFixed(2)}?`,
        type: 'confirm'
      }
    }).afterClosed().subscribe(confirmado => {
      if (!confirmado) { return; }

      this.loadingService.show();
      this.servicio.borrar(this.codEmpresa, this.codSucursal, op.numOrden!).subscribe({
        next: () => {
          this.loadingService.hide();
          this.ordenes = this.ordenes.filter(o => o.numOrden !== op.numOrden);
        },
        error: (err) => {
          this.loadingService.hide();
          Swal.fire('No se pudo borrar',
            err?.error?.mensaje ?? 'No se pudo borrar la orden.', 'error');
        }
      });
    });
  }

  /* ------------------------------------------------------------- apoyo */

  moneda(op: OrdenPagoPropia): string {
    return op.codMoneda === 'US' ? 'US$' : 'S/';
  }

  /** Cómo se ve el estado. Los dos caracteres del ERP no le dicen nada a nadie. */
  estadoLegible(op: OrdenPagoPropia): string {
    switch (op.tipEstado) {
      case 'PE': return 'PENDIENTE';
      case 'RE': return 'RENDIDA';
      case 'LI': return 'LIQUIDADA';
      default:   return op.tipEstado ?? '—';
    }
  }

  claseEstado(op: OrdenPagoPropia): string {
    switch (op.tipEstado) {
      case 'PE': return 'estado-pendiente';
      case 'RE': return 'estado-rendida';
      case 'LI': return 'estado-liquidada';
      default:   return '';
    }
  }

  /** Rojo cuando se rindió de más: es el caso que hay que mirar. */
  claseSaldo(op: OrdenPagoPropia): string {
    const s = op.saldo ?? 0;
    if (s < 0) { return 'saldo-excedido'; }
    if (s === 0) { return 'saldo-cerrado'; }
    return '';
  }

  get totalEntregado(): number {
    return this.ordenes.reduce((a, o) => a + (o.impOrdPago ?? 0), 0);
  }

  get totalPendiente(): number {
    return this.ordenes.reduce((a, o) => a + (o.saldo ?? 0), 0);
  }

  private userId(): number | undefined {
    const v = sessionStorage.getItem('userid');
    return v ? Number(v) : undefined;
  }
}
