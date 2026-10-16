import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { ImportarAnexosDialogComponent } from '../../../components/dialogs/importar-anexos-dialog.component';
import { ImportarOpDialogComponent } from '../../../components/dialogs/importar-op-dialog.component';
import { OrdenPagoDialogComponent } from '../../../components/dialogs/orden-pago-dialog.component';
import { LoadingService } from '../../../services/loading.service';
import { OrdenPagoPropiaService } from '../../../services/orden-pago-propia.service';
import { OrdenPagoPropia } from '../../../models/orden-pago-propia';

/**
 * Importaciones de RENDIX CONCAR.
 *
 * Es la puerta de entrada de todo lo que viene de afuera: las órdenes de pago
 * y los maestros que el asiento necesita para salir completo. **No lista
 * nada**, y eso es deliberado. La lista de órdenes de pago es la de Rendición
 * de Cuentas, que es donde el usuario después carga comprobantes, planillas y
 * devoluciones. Dos grillas con las mismas órdenes obligan a preguntarse cuál
 * es la buena cada vez que los números no coinciden.
 *
 * En la instalación de Aquarius esta pantalla no existe: allá las órdenes y
 * los maestros vienen del ERP y no hay nada que cargar.
 */
@Component({
  selector: 'app-list-ordenes-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-ordenes-pago.component.html',
  styleUrls: ['./list-ordenes-pago.component.scss']
})
export class ListOrdenesPagoComponent {

  codEmpresa: string = sessionStorage.getItem('codempresa') ?? '';
  codSucursal: string = sessionStorage.getItem('codsucursal') ?? '001';

  guardando = false;

  /** Cuántas se cargaron en esta visita. Solo para el aviso de la pantalla. */
  cargadasEnEstaSesion = 0;

  /** Si en esta visita se tocó el maestro de anexos. */
  anexosCargados = false;

  constructor(
    private servicio: OrdenPagoPropiaService,
    private loadingService: LoadingService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  /* ------------------------------------------------------ carga por Excel */

  importar(): void {
    this.dialog.open(ImportarOpDialogComponent, {
      width: '1000px',
      maxWidth: '96vw',
      data: {
        codEmpresa: this.codEmpresa,
        codSucursal: this.codSucursal,
        userId: this.userId()
      }
    }).afterClosed().subscribe((cargo: boolean) => {
      if (cargo) { this.cargadasEnEstaSesion++; }
    });
  }

  /* ---------------------------------------------------------- los anexos */

  /**
   * Carga del maestro de anexos.
   *
   * Es lo primero que hay que cargar en una instalación nueva: sin anexos, la
   * importación de órdenes rechaza toda fila que traiga un DNI y la
   * contrapartida del asiento sale sin código de anexo.
   */
  importarAnexos(): void {
    this.dialog.open(ImportarAnexosDialogComponent, {
      width: '1000px',
      maxWidth: '96vw',
      data: {
        codEmpresa: this.codEmpresa,
        usuario: sessionStorage.getItem('username') ?? undefined
      }
    }).afterClosed().subscribe((cargo: boolean) => {
      if (cargo) { this.anexosCargados = true; }
    });
  }

  /* ------------------------------------------------------- carga de a una */

  nueva(): void {
    this.abrirDialogo(undefined, []);
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

    const dto: OrdenPagoPropia = {
      ...op,
      codEmpresa: this.codEmpresa,
      codSucursal: this.codSucursal
    };

    this.servicio.crear(dto, this.userId()).subscribe({
      next: (r) => {
        this.guardando = false;
        this.loadingService.hide();
        this.cargadasEnEstaSesion++;
        Swal.fire({ icon: 'success', title: r?.mensaje ?? 'Listo',
                    timer: 1800, showConfirmButton: false });
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

  /* -------------------------------------------------------------- navegar */

  /** A donde están las órdenes de verdad. */
  verOrdenes(): void {
    this.router.navigate(['/list-orders']);
  }

  /** A los parámetros del asiento. */
  verParametria(): void {
    this.router.navigate(['/parametria-concar']);
  }

  private userId(): number | undefined {
    const v = sessionStorage.getItem('userid');
    return v ? Number(v) : undefined;
  }
}
