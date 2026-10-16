import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { ParametriaConcarService } from '../../services/parametria-concar.service';
import { Response } from '../../models/response';
import {
  CuentaGasto, EquivalenciaConcar, ParametroConcar,
  ResultadoTipoCambio, TipoCambio
} from '../../models/parametria-concar';

type Seccion = 'cuentas' | 'parametros' | 'equivalencias' | 'tipocambio';

/**
 * Los parámetros del asiento de CONCAR, editables.
 *
 * Hasta ahora estos valores solo se tocaban corriendo un script SQL. Los
 * escribimos nosotros a partir de lo que entendimos de la documentación, y más
 * de uno estaba mal —la cuenta de entrega apuntaba a préstamos al personal—
 * sin que contabilidad tuviera forma de verlo ni de corregirlo.
 *
 * De ahí la columna **provisional**: marca las filas que todavía son una
 * suposición nuestra. Se apaga sola al guardar, porque guardar desde acá ya es
 * una persona de contabilidad mirando el valor.
 */
@Component({
  selector: 'app-parametria-concar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametria-concar.component.html',
  styleUrls: ['./parametria-concar.component.scss']
})
export class ParametriaConcarComponent implements OnInit {

  codEmpresa: string = sessionStorage.getItem('codempresa') ?? '';

  seccion: Seccion = 'cuentas';
  cargando = false;
  guardando = false;

  cuentas: CuentaGasto[] = [];
  parametros: ParametroConcar[] = [];
  equivalencias: EquivalenciaConcar[] = [];
  tiposDeCambio: TipoCambio[] = [];

  /** La fila que se está editando, como copia. Cancelar no deja rastro. */
  editando: unknown = null;
  borrador: any = null;

  /** Carga manual de tipo de cambio. */
  tcNuevo: TipoCambio = { fecha: '', venta: undefined, compra: undefined };

  constructor(private servicio: ParametriaConcarService) {}

  ngOnInit(): void {
    this.cargar();
  }

  /* ------------------------------------------------------------- navegar */

  ir(s: Seccion): void {
    if (this.seccion === s) { return; }
    this.seccion = s;
    this.cancelar();
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    const listo = (f: () => void) => { this.cargando = false; f(); };

    if (this.seccion === 'cuentas') {
      this.servicio.cuentas(this.codEmpresa).subscribe({
        next: (r) => listo(() => this.cuentas = (r?.resultado as CuentaGasto[]) ?? []),
        error: (e) => listo(() => this.fallo(e, 'No se pudieron leer las cuentas'))
      });

    } else if (this.seccion === 'parametros') {
      this.servicio.parametros(this.codEmpresa).subscribe({
        next: (r) => listo(() => this.parametros = (r?.resultado as ParametroConcar[]) ?? []),
        error: (e) => listo(() => this.fallo(e, 'No se pudieron leer los parámetros'))
      });

    } else if (this.seccion === 'equivalencias') {
      this.servicio.equivalencias(this.codEmpresa).subscribe({
        next: (r) => listo(() => this.equivalencias = (r?.resultado as EquivalenciaConcar[]) ?? []),
        error: (e) => listo(() => this.fallo(e, 'No se pudieron leer las equivalencias'))
      });

    } else {
      this.servicio.tiposDeCambio(60).subscribe({
        next: (r) => listo(() => this.tiposDeCambio = (r?.resultado as TipoCambio[]) ?? []),
        error: (e) => listo(() => this.fallo(e, 'No se pudo leer el tipo de cambio'))
      });
    }
  }

  /* -------------------------------------------------------------- editar */

  /** Cuántas filas de la sección siguen siendo suposición nuestra. */
  get provisionales(): number {
    const filas: Array<{ indProvisional?: string }> =
      this.seccion === 'cuentas' ? this.cuentas
      : this.seccion === 'parametros' ? this.parametros
      : this.seccion === 'equivalencias' ? this.equivalencias
      : [];
    return filas.filter(f => f.indProvisional === 'S').length;
  }

  editar(fila: unknown): void {
    this.editando = fila;
    this.borrador = { ...(fila as object) };
  }

  cancelar(): void {
    this.editando = null;
    this.borrador = null;
  }

  /** Una fila en blanco al final, para agregar sin abrir otro diálogo. */
  agregar(): void {
    const nueva: any = this.seccion === 'cuentas'
      ? { codEmpresa: this.codEmpresa, codTipoGasto: '', cuentaGasto: '',
          indCCostos: 'N', indAnexo: 'N', descripcion: '' }
      : this.seccion === 'parametros'
      ? { codEmpresa: this.codEmpresa, clave: '', valor: '', descripcion: '' }
      : { codEmpresa: this.codEmpresa, tipo: 'DOCUMENTO', valorErp: '',
          valorConcar: '', descripcion: '' };

    if (this.seccion === 'cuentas') { this.cuentas = [...this.cuentas, nueva]; }
    else if (this.seccion === 'parametros') { this.parametros = [...this.parametros, nueva]; }
    else { this.equivalencias = [...this.equivalencias, nueva]; }

    this.editar(nueva);
  }

  guardar(): void {
    if (!this.borrador) { return; }
    this.guardando = true;

    const b = { ...this.borrador, codEmpresa: this.codEmpresa };
    const uid = this.userId();

    const peticion =
      this.seccion === 'cuentas'       ? this.servicio.guardarCuenta(b, uid)
      : this.seccion === 'parametros'  ? this.servicio.guardarParametro(b, uid)
      :                                  this.servicio.guardarEquivalencia(b, uid);

    peticion.subscribe({
      next: (r) => {
        this.guardando = false;
        this.cancelar();
        this.cargar();
        Swal.fire({ icon: 'success', title: r?.mensaje ?? 'Guardado',
                    timer: 1600, showConfirmButton: false });
      },
      error: (e) => {
        this.guardando = false;
        /* 400 con el motivo: el servidor dice qué está mal escrito. No se
           cierra la edición, que es lo que hay que corregir. */
        this.fallo(e, 'No se pudo guardar');
      }
    });
  }

  borrar(fila: any): void {
    const que = this.seccion === 'cuentas'
      ? `la cuenta del tipo de gasto ${fila.codTipoGasto}`
      : `la equivalencia ${fila.valorErp} → ${fila.valorConcar}`;

    Swal.fire({
      icon: 'warning', title: '¿Borrar?',
      html: `Se va a borrar <strong>${que}</strong>.`,
      showCancelButton: true, confirmButtonText: 'Borrar', cancelButtonText: 'No'
    }).then((res) => {
      if (!res.isConfirmed) { return; }
      const peticion = this.seccion === 'cuentas'
        ? this.servicio.borrarCuenta(this.codEmpresa, fila.codTipoGasto)
        : this.servicio.borrarEquivalencia(this.codEmpresa, fila.tipo, fila.valorErp);

      peticion.subscribe({
        next: () => this.cargar(),
        error: (e) => this.fallo(e, 'No se pudo borrar')
      });
    });
  }

  /* -------------------------------------------------------- tipo de cambio */

  actualizarTc(): void {
    this.guardando = true;
    this.servicio.actualizarTipoCambio(this.usuario()).subscribe({
      next: (r) => {
        this.guardando = false;
        const res = r?.resultado as ResultadoTipoCambio;
        this.cargar();
        if (res?.traidos?.length) {
          Swal.fire('Actualizado', r?.mensaje ?? '', 'success');
        } else {
          /* No es un error: SUNAT no publica sábados, domingos ni feriados.
             Se informa sin alarmar y queda la carga manual. */
          Swal.fire('Sin novedades', r?.mensaje ?? '', 'info');
        }
      },
      error: (e) => {
        this.guardando = false;
        this.fallo(e, 'No se pudo consultar el servicio');
      }
    });
  }

  guardarTcManual(): void {
    if (!this.tcNuevo.fecha || (this.tcNuevo.venta == null && this.tcNuevo.compra == null)) {
      Swal.fire('Faltan datos', 'Cargue la fecha y al menos el tipo de cambio de venta.', 'warning');
      return;
    }
    this.guardando = true;
    this.servicio.tipoCambioManual(this.tcNuevo, this.usuario()).subscribe({
      next: (r) => {
        this.guardando = false;
        this.tcNuevo = { fecha: '', venta: undefined, compra: undefined };
        this.cargar();
        Swal.fire({ icon: 'success', title: r?.mensaje ?? 'Guardado',
                    timer: 1600, showConfirmButton: false });
      },
      error: (e) => {
        this.guardando = false;
        this.fallo(e, 'No se pudo guardar');
      }
    });
  }

  /* ------------------------------------------------------------ plomería */

  private userId(): number | undefined {
    const v = sessionStorage.getItem('userid');
    return v ? Number(v) : undefined;
  }

  private usuario(): string | undefined {
    return sessionStorage.getItem('username') ?? undefined;
  }

  private fallo(err: unknown, titulo: string): void {
    const e = err as { error?: Response };
    Swal.fire(titulo, e?.error?.mensaje ?? 'Intente de nuevo.', 'error');
  }
}
