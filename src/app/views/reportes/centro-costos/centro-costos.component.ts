import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { OrdenPagoService } from '../../../services/orden-pago.service';
import { ReportsService } from '../../../services/reports.service';
import { OrdenPago } from '../../../models/orden-pago';
import { WrapperRequestOrdenPago } from '../../../models/wrappers/wrapper-request-orden-pago';
import { Response } from '../../../models/response';

/** Una fila del cuadro: un centro de costos con sus totales. */
interface FilaCentro {
  codigo: string;
  ordenes: number;
  entregado: number;
  rendido: number;
  pendiente: number;
  porcentaje: number;
  /** OPs del centro que todavía no se rindieron. */
  sinRendir: number;
}

/**
 * En qué centro de costos se está yendo la plata.
 *
 * Agrupa las órdenes de pago por centro y muestra, para cada uno, cuánto se
 * entregó, cuánto volvió rendido y qué queda pendiente.
 *
 * <p>Los importes se convierten a soles con el tipo de cambio de cada orden
 * antes de sumar. El PDF anterior sumaba `impRendidoSoles + impRendidoDolares`
 * directamente: una orden en dólares entraba dos veces y por el número
 * equivocado, y el porcentaje de participación salía mal para todos los
 * centros, no solo para ese.
 */
@Component({
  selector: 'app-centro-costos',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './centro-costos.component.html',
  styleUrls: ['./centro-costos.component.scss']
})
export class CentroCostosComponent implements OnInit {

  isLoading$: Observable<boolean>;

  ordenes: OrdenPago[] = [];
  buscoAlgunaVez = false;
  generandoPdf = false;

  // --- filtros
  desde = '';
  hasta = '';
  persona = '';
  centro = '';
  /** Solo las que todavía deben algo. */
  soloConPendiente = false;

  constructor(
    private opService: OrdenPagoService,
    private reportsService: ReportsService,
    private loadingService: LoadingService,
    private router: Router,
    private location: Location
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    this.rangoUltimoMes();
    this.buscar();
  }

  rangoUltimoMes(): void {
    const hoy = new Date();
    const mesAtras = new Date();
    mesAtras.setMonth(mesAtras.getMonth() - 1);
    this.desde = this.aIso(mesAtras);
    this.hasta = this.aIso(hoy);
  }

  verTodoElHistorial(): void {
    this.desde = '';
    this.hasta = '';
  }

  buscar(): void {
    this.loadingService.show();

    const u = this.contextoUsuario();
    const wrapper = new WrapperRequestOrdenPago();
    wrapper.codEmpresa = u.codEmpresa;
    wrapper.codSucursal = u.codSucursal;
    wrapper.codAuxiliar = u.codAuxiliar;
    wrapper.isAdmin = u.isAdmin;

    this.opService.getOrdenesPago(wrapper).subscribe({
      next: (r: Response) => {
        this.loadingService.hide();
        this.buscoAlgunaVez = true;
        this.ordenes = (r?.resultado as OrdenPago[]) ?? [];
      },
      error: (err) => {
        this.loadingService.hide();
        this.buscoAlgunaVez = true;
        this.ordenes = [];
        console.error('[centro-costos] no se pudieron obtener las órdenes:', err);
      }
    });
  }

  limpiar(): void {
    this.persona = '';
    this.centro = '';
    this.soloConPendiente = false;
    this.rangoUltimoMes();
  }

  volver(): void {
    this.location.back();
  }

  /** El detalle por comprobante, del lado de REGINA. */
  verRendiciones(): void {
    this.router.navigate(['/reportes-rendicion'], { queryParams: { vista: 'centros' } });
  }

  // ------------------------------------------------------------ importes

  /**
   * El importe de la orden, en soles.
   *
   * `impOrdPago` viene en la moneda de la orden, así que hay que convertir
   * antes de sumar entre centros. Sin esto, un centro con gastos en dólares
   * parece tres veces más chico de lo que es.
   */
  private aSoles(monto: number | undefined, o: OrdenPago): number {
    const valor = monto ?? 0;
    if (!valor) { return 0; }
    if (o.codMoneda === '01') { return valor; }
    return valor * (o.tipCambio ?? 1);
  }

  /** Lo rendido, en soles, según la moneda de la orden. */
  private rendidoEnSoles(o: OrdenPago): number {
    return o.codMoneda === '01'
      ? (o.impRendidoSoles ?? 0)
      : (o.impRendidoDolares ?? 0) * (o.tipCambio ?? 1);
  }

  // ------------------------------------------------------------ cuadro

  private get ordenesFiltradas(): OrdenPago[] {
    const persona = this.persona.trim().toLowerCase();
    const centro = this.centro.trim().toLowerCase();

    return this.ordenes.filter(o => {
      if (this.desde || this.hasta) {
        if (!o.fecOrden) { return false; }
        const fecha = this.aIso(new Date(o.fecOrden));
        if (this.desde && fecha < this.desde) { return false; }
        if (this.hasta && fecha > this.hasta) { return false; }
      }
      if (persona) {
        const quien = `${o.cdesAuxiliar ?? ''} ${o.codAuxiliar ?? ''}`.toLowerCase();
        if (!quien.includes(persona)) { return false; }
      }
      if (centro && !(o.codCCostos ?? '').toLowerCase().includes(centro)) { return false; }
      return true;
    });
  }

  get filas(): FilaCentro[] {
    const mapa = new Map<string, FilaCentro>();

    for (const o of this.ordenesFiltradas) {
      // Sin centro de costos es un dato real —órdenes que se cargaron sin
      // imputar— y merece verse, no esconderse en el resto.
      const codigo = (o.codCCostos ?? '').trim() || 'SIN IMPUTAR';

      let fila = mapa.get(codigo);
      if (!fila) {
        fila = { codigo, ordenes: 0, entregado: 0, rendido: 0,
                 pendiente: 0, porcentaje: 0, sinRendir: 0 };
        mapa.set(codigo, fila);
      }

      const entregado = this.aSoles(o.impOrdPago, o);
      const rendido = this.rendidoEnSoles(o);

      fila.ordenes += 1;
      fila.entregado += entregado;
      fila.rendido += rendido;
      if (rendido <= 0) { fila.sinRendir += 1; }
    }

    const total = Array.from(mapa.values()).reduce((s, f) => s + f.entregado, 0);

    const filas = Array.from(mapa.values()).map(f => ({
      ...f,
      pendiente: f.entregado - f.rendido,
      porcentaje: total > 0 ? (f.entregado / total) * 100 : 0,
    }));

    return filas
      .filter(f => !this.soloConPendiente || f.pendiente > 0.005)
      .sort((a, b) => b.entregado - a.entregado);
  }

  // --- totales
  get totalCentros(): number { return this.filas.length; }
  get totalOrdenes(): number { return this.filas.reduce((s, f) => s + f.ordenes, 0); }
  get totalEntregado(): number { return this.filas.reduce((s, f) => s + f.entregado, 0); }
  get totalRendido(): number { return this.filas.reduce((s, f) => s + f.rendido, 0); }
  get totalPendiente(): number { return this.totalEntregado - this.totalRendido; }

  get porcentajeRendido(): number {
    return this.totalEntregado > 0 ? (this.totalRendido / this.totalEntregado) * 100 : 0;
  }

  /** Órdenes en moneda distinta de soles: avisa que hay conversión de por medio. */
  get ordenesEnDolares(): number {
    return this.ordenesFiltradas.filter(o => o.codMoneda !== '01').length;
  }

  // ------------------------------------------------------------ salidas

  descargarPdf(): void {
    if (this.generandoPdf) { return; }
    this.generandoPdf = true;
    this.loadingService.show();

    this.reportsService.reporteCentroCostos().subscribe({
      next: () => { this.generandoPdf = false; this.loadingService.hide(); },
      error: () => { this.generandoPdf = false; this.loadingService.hide(); }
    });
  }

  descargarCsv(): void {
    const filas: string[][] = [[
      'Centro de costos', 'Ordenes', 'Sin rendir', 'Entregado S/', 'Rendido S/',
      'Pendiente S/', '% del total'
    ]];

    for (const f of this.filas) {
      filas.push([
        f.codigo, String(f.ordenes), String(f.sinRendir),
        f.entregado.toFixed(2), f.rendido.toFixed(2),
        f.pendiente.toFixed(2), f.porcentaje.toFixed(1),
      ]);
    }

    const csv = filas
      .map(f => f.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `centro_de_costos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ------------------------------------------------------------ helpers

  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private contextoUsuario() {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || '{}');
      return {
        isAdmin: !!u.userAdmin,
        codAuxiliar: u.codAuxiliar || '',
        codEmpresa: u.codEmpresa || '',
        codSucursal: u.codSucursal || '',
      };
    } catch {
      return { isAdmin: false, codAuxiliar: '', codEmpresa: '', codSucursal: '' };
    }
  }
}
