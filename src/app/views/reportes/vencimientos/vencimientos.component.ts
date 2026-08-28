import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { OrdenPagoService } from '../../../services/orden-pago.service';
import { ReportsService } from '../../../services/reports.service';
import { OrdenPago } from '../../../models/orden-pago';
import { WrapperRequestOrdenPago } from '../../../models/wrappers/wrapper-request-orden-pago';
import { Response } from '../../../models/response';

type Tramo = 'todas' | 'vencidas' | 'siete' | 'treinta';

/**
 * Órdenes con el plazo de rendición vencido o por vencer.
 *
 * Antes esto solo existía como PDF: para ver otro corte había que generar el
 * documento entero de nuevo, y no se podía buscar a una persona. Acá los
 * filtros se aplican sobre lo mismo, en el momento, y el PDF queda como un
 * botón para cuando hay que mandarlo o archivarlo.
 *
 * <p>El plazo sale de `fecRendicion` del ERP, que no es la fecha en que se
 * rindió sino la fecha límite: son los 9 días que el ERP calcula al crear la
 * orden. Se verificó contra los datos —24 de 25 órdenes dan exactamente 9
 * días— y es lo que ya usaba el PDF.
 */
@Component({
  selector: 'app-vencimientos',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './vencimientos.component.html',
  styleUrls: ['./vencimientos.component.scss']
})
export class VencimientosComponent implements OnInit {

  isLoading$: Observable<boolean>;

  ordenes: OrdenPago[] = [];
  buscoAlgunaVez = false;
  generandoPdf = false;

  // --- filtros
  tramo: Tramo = 'todas';
  persona = '';
  numOrden = '';
  /** Solo las que todavía no se rindieron por REGINA. */
  soloSinRendir = false;

  /** Rango sobre la fecha de la orden. Arranca en el último mes. */
  desde = '';
  hasta = '';

  paginaActual = 0;
  readonly tamanioPagina = 15;

  constructor(
    private opService: OrdenPagoService,
    private reportsService: ReportsService,
    private loadingService: LoadingService,
    private location: Location
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    this.rangoUltimoMes();
    this.buscar();
  }

  /**
   * El último mes, que es lo que se mira casi siempre.
   *
   * El rango va sobre la fecha de la orden y no sobre la de vencimiento: es
   * lo que la gente tiene en la cabeza cuando dice "las de este mes". Pero
   * acota, y una orden vieja vencida queda afuera — por eso la pantalla avisa
   * cuando el rango está escondiendo vencidas.
   */
  rangoUltimoMes(): void {
    const hoy = new Date();
    const mesAtras = new Date();
    mesAtras.setMonth(mesAtras.getMonth() - 1);

    this.desde = this.aIso(mesAtras);
    this.hasta = this.aIso(hoy);
    this.paginaActual = 0;
  }

  /** Quita el rango: se ven todas, incluidas las vencidas viejas. */
  verTodoElHistorial(): void {
    this.desde = '';
    this.hasta = '';
    this.paginaActual = 0;
  }

  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
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
        this.paginaActual = 0;
        // Solo las que están en riesgo de verdad: una orden ya liquidada o
        // anulada no vence, y listarla convierte el reporte en un padrón.
        this.ordenes = ((r?.resultado as OrdenPago[]) ?? [])
          .filter(o => (o.tipEstado === 'EM' || o.tipEstado === 'PE') && !!o.fecRendicion);
      },
      error: (err) => {
        this.loadingService.hide();
        this.buscoAlgunaVez = true;
        this.ordenes = [];
        console.error('[vencimientos] no se pudieron obtener las órdenes:', err);
      }
    });
  }

  limpiar(): void {
    this.tramo = 'todas';
    this.persona = '';
    this.numOrden = '';
    this.soloSinRendir = false;
    this.rangoUltimoMes();
  }

  volver(): void {
    this.location.back();
  }

  // ------------------------------------------------------------ cálculo

  /**
   * Días que faltan para el vencimiento. Negativo si ya venció.
   *
   * Se comparan fechas sin hora: si no, una orden que vence hoy a las 00:00
   * aparecería como vencida desde el primer minuto del día.
   */
  dias(o: OrdenPago): number | null {
    if (!o.fecRendicion) { return null; }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vence = new Date(o.fecRendicion);
    vence.setHours(0, 0, 0, 0);
    return Math.floor((vence.getTime() - hoy.getTime()) / 86400000);
  }

  estaVencida(o: OrdenPago): boolean {
    const d = this.dias(o);
    return d !== null && d < 0;
  }

  claseFila(o: OrdenPago): string {
    const d = this.dias(o);
    if (d === null) { return ''; }
    if (d < 0)  { return 'venc-vencida'; }
    if (d <= 7) { return 'venc-urgente'; }
    if (d <= 30) { return 'venc-proxima'; }
    return 'venc-lejana';
  }

  etiquetaDias(o: OrdenPago): string {
    const d = this.dias(o);
    if (d === null) { return '—'; }
    if (d < 0)  { return `${Math.abs(d)} d de atraso`; }
    if (d === 0) { return 'vence hoy'; }
    return `en ${d} d`;
  }

  // ------------------------------------------------------------ filtrado

  get filtradas(): OrdenPago[] {
    const persona = this.persona.trim().toLowerCase();
    const orden = this.numOrden.trim().toLowerCase();

    return this.ordenes.filter(o => {
      const d = this.dias(o);
      if (d === null) { return false; }

      if (!this.entraEnElRango(o)) { return false; }

      if (this.tramo === 'vencidas' && d >= 0) { return false; }
      if (this.tramo === 'siete'    && (d < 0 || d > 7)) { return false; }
      if (this.tramo === 'treinta'  && (d <= 7 || d > 30)) { return false; }

      if (this.soloSinRendir && o.estadoRendicion === 'RENDIDA') { return false; }

      if (persona) {
        const quien = `${o.cdesAuxiliar ?? ''} ${o.codAuxiliar ?? ''}`.toLowerCase();
        if (!quien.includes(persona)) { return false; }
      }
      if (orden && !(o.numOrden ?? '').toLowerCase().includes(orden)) { return false; }

      return true;
    }).sort((a, b) => (this.dias(a) ?? 0) - (this.dias(b) ?? 0));
  }

  /** Si la orden cae dentro del rango de fechas elegido. */
  private entraEnElRango(o: OrdenPago): boolean {
    if (!this.desde && !this.hasta) { return true; }
    if (!o.fecOrden) { return false; }

    const fecha = this.aIso(new Date(o.fecOrden));
    if (this.desde && fecha < this.desde) { return false; }
    if (this.hasta && fecha > this.hasta) { return false; }
    return true;
  }

  // --- indicadores sobre el rango elegido, no sobre lo demás filtrado: si
  //     cambiaran al buscar una persona, dejarían de servir para comparar.
  private get enElRango(): OrdenPago[] {
    return this.ordenes.filter(o => this.entraEnElRango(o));
  }

  get vencidas(): number {
    return this.enElRango.filter(o => (this.dias(o) ?? 1) < 0).length;
  }

  get vencenEn7(): number {
    return this.enElRango.filter(o => { const d = this.dias(o); return d !== null && d >= 0 && d <= 7; }).length;
  }

  get vencenEn30(): number {
    return this.enElRango.filter(o => { const d = this.dias(o); return d !== null && d > 7 && d <= 30; }).length;
  }

  get importeVencido(): number {
    return this.enElRango
      .filter(o => (this.dias(o) ?? 1) < 0)
      .reduce((suma, o) => suma + (o.impOrdPago ?? 0), 0);
  }

  /**
   * Vencidas que el rango está dejando afuera.
   *
   * Es el precio de acotar por fecha de orden: las más atrasadas son
   * justamente las más viejas, y son las que primero desaparecen. Mostrarlo
   * evita que un tablero en cero se lea como que no hay nada pendiente.
   */
  get vencidasFueraDelRango(): number {
    if (!this.desde && !this.hasta) { return 0; }
    return this.ordenes.filter(o =>
      (this.dias(o) ?? 1) < 0 && !this.entraEnElRango(o)).length;
  }

  // ------------------------------------------------------------ paginado

  get pagina(): OrdenPago[] {
    const desde = this.paginaActual * this.tamanioPagina;
    return this.filtradas.slice(desde, desde + this.tamanioPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.filtradas.length / this.tamanioPagina);
  }

  irAPagina(p: number): void {
    if (p >= 0 && p < this.totalPaginas) { this.paginaActual = p; }
  }

  cambiarTramo(t: Tramo): void {
    this.tramo = t;
    this.paginaActual = 0;
  }

  // ------------------------------------------------------------ salidas

  /** El PDF de siempre, ahora como una salida más y no como el único camino. */
  descargarPdf(): void {
    if (this.generandoPdf) { return; }
    this.generandoPdf = true;
    this.loadingService.show();

    this.reportsService.reporteVencimientos().subscribe({
      next: () => { this.generandoPdf = false; this.loadingService.hide(); },
      error: () => { this.generandoPdf = false; this.loadingService.hide(); }
    });
  }

  /** Con punto y coma y BOM: así lo abre el Excel en español sin preguntar. */
  descargarCsv(): void {
    const filas: string[][] = [[
      'Nro OP', 'Fecha orden', 'Beneficiario', 'Estado ERP', 'Rendicion REGINA',
      'Vence', 'Dias', 'Importe'
    ]];

    for (const o of this.filtradas) {
      filas.push([
        o.numOrden ?? '',
        this.aTexto(o.fecOrden),
        o.cdesAuxiliar ?? o.codAuxiliar ?? '',
        o.tipEstado ?? '',
        o.estadoRendicion ?? 'Sin rendir',
        this.aTexto(o.fecRendicion),
        String(this.dias(o) ?? ''),
        String(o.impOrdPago ?? 0),
      ]);
    }

    const csv = filas
      .map(f => f.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vencimientos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private aTexto(fecha?: Date | string): string {
    if (!fecha) { return ''; }
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
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
