import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import Swal from 'sweetalert2';

import { ColumnaPdf, ReportePdf, fecha as fmtFecha, nro } from '../../../shared/reporte-pdf';
import { CruceService } from '../../../services/cruce.service';
import { FiltroCruce, OpCruce } from '../../../models/op-cruce';

/**
 * Órdenes de pago del ERP, con y sin rendición en REGINA.
 *
 * Los reportes de rendición salen de REGINA, así que solo pueden mostrar lo
 * que alguien ya empezó a rendir. Esta pantalla arranca del otro lado: de las
 * entregas a rendir cuenta que hay en contabilidad. Por eso es la única que
 * puede contestar quién no rindió nada — la fila existe aunque REGINA no sepa
 * nada de esa orden.
 */
@Component({
  selector: 'app-op-rendiciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './op-rendiciones.component.html',
  styleUrls: ['./op-rendiciones.component.scss']
})
export class OpRendicionesComponent implements OnInit {

  codEmpresa: string = sessionStorage.getItem('codempresa') ?? '';
  codSucursal: string = '001';

  filtro = new FiltroCruce();
  filas: OpCruce[] = [];

  cargando = false;
  buscoAlgunaVez = false;

  /** Paginado en memoria: la consulta trae todo y la tabla muestra de a 50. */
  pagina = 0;
  readonly porPagina = 50;

  readonly estadosErp = [
    { valor: '',   etiqueta: 'Todos' },
    { valor: 'EM', etiqueta: 'Emitida' },
    { valor: 'PE', etiqueta: 'Pendiente' },
    { valor: 'LQ', etiqueta: 'Liquidada' },
  ];

  readonly situaciones = [
    { valor: '',    etiqueta: 'Todas' },
    { valor: 'SIN', etiqueta: 'Sin rendición cargada' },
    { valor: 'CON', etiqueta: 'Con rendición en REGINA' },
  ];

  readonly estadosRegina = [
    { valor: '',             etiqueta: 'Todos' },
    { valor: 'PENDIENTE',    etiqueta: 'Pendiente' },
    { valor: 'EN_PROCESO',   etiqueta: 'En proceso' },
    { valor: 'RECEPCIONADO', etiqueta: 'Recepcionado' },
    { valor: 'OBSERVADO',    etiqueta: 'Observado' },
    { valor: 'LIQUIDADO',    etiqueta: 'Liquidado' },
  ];

  constructor(
    private servicio: CruceService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.ponerRangoPorDefecto();
    this.buscar();
  }

  // ------------------------------------------------------------ filtros

  /** El mes en curso completo, del día 1 al último. */
  private ponerRangoPorDefecto(): void {
    const hoy = new Date();
    this.filtro.desde = this.aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    this.filtro.hasta = this.aISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
  }

  /** yyyy-MM-dd con la fecha local: toISOString pasa a UTC y en Lima resta un día. */
  private aISO(f: Date): string {
    const mes = String(f.getMonth() + 1).padStart(2, '0');
    const dia = String(f.getDate()).padStart(2, '0');
    return `${f.getFullYear()}-${mes}-${dia}`;
  }

  buscar(): void {
    this.cargando = true;
    this.servicio.buscar(this.codEmpresa, this.codSucursal, this.filtro).subscribe({
      next: r => {
        this.filas = r ?? [];
        this.pagina = 0;
        this.buscoAlgunaVez = true;
        this.cargando = false;
      },
      error: e => {
        console.error('[op-rendiciones] no se pudo obtener el reporte:', e);
        this.filas = [];
        this.buscoAlgunaVez = true;
        this.cargando = false;
        Swal.fire('No se pudo obtener el reporte',
          'Revisá los filtros e intentá de nuevo.', 'error');
      }
    });
  }

  limpiar(): void {
    this.filtro = new FiltroCruce();
    this.ponerRangoPorDefecto();
    this.buscar();
  }

  volver(): void {
    this.location.back();
  }

  // ------------------------------------------------------------ totales

  get totalOrdenes(): number { return this.filas.length; }

  get sinRendir(): number {
    return this.filas.filter(f => !f.tieneRendicion).length;
  }

  get enProceso(): number {
    return this.filas.filter(f => f.estProceso === 'EN_PROCESO'
                               || f.estProceso === 'RECEPCIONADO').length;
  }

  get liquidadas(): number {
    return this.filas.filter(f => f.estProceso === 'LIQUIDADO').length;
  }

  get totalEntregado(): number {
    return this.filas.reduce((s, f) => s + (f.impOrdPago ?? 0), 0);
  }

  get totalRendido(): number {
    return this.filas.reduce((s, f) => s + (f.impRendido ?? 0), 0);
  }

  get totalSaldo(): number {
    return this.filas.reduce((s, f) => s + (f.saldo ?? 0), 0);
  }

  // ----------------------------------------------------------- paginado

  get paginaActual(): OpCruce[] {
    const desde = this.pagina * this.porPagina;
    return this.filas.slice(desde, desde + this.porPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.filas.length / this.porPagina));
  }

  irA(p: number): void {
    if (p >= 0 && p < this.totalPaginas) { this.pagina = p; }
  }

  // ------------------------------------------------------------ estilos

  claseProceso(estado?: string): string {
    switch (estado) {
      case 'LIQUIDADO':    return 'pr-liq';
      case 'OBSERVADO':    return 'pr-obs';
      case 'RECEPCIONADO': return 'pr-recep';
      case 'EN_PROCESO':   return 'pr-proc';
      default:             return 'pr-pend';
    }
  }

  /** Verde hasta 9 días, ámbar hasta 20, rojo más allá. */
  claseDias(dias?: number): string {
    if (dias == null) { return ''; }
    if (dias <= 9)  { return 'd-ok'; }
    if (dias <= 20) { return 'd-medio'; }
    return 'd-tarde';
  }

  // ------------------------------------------------------------ Excel

  /** El usuario logueado, para que el reporte diga quien lo genero. */
  private get usuarioActual(): string {
    try {
      const guardado = sessionStorage.getItem('user');
      if (!guardado) { return ''; }
      const u = JSON.parse(guardado);
      return u?.userUsername ?? u?.username ?? '';
    } catch {
      return '';
    }
  }

  descargarExcel(): void {
    const usuario = this.usuarioActual;
    this.servicio.excel(this.codEmpresa, this.codSucursal, this.filtro, usuario).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ordenes_y_rendiciones_${this.aISO(new Date())}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: e => {
        console.error('[op-rendiciones] no se pudo bajar el Excel:', e);
        Swal.fire('No se pudo generar el Excel', 'Intentá de nuevo en un momento.', 'error');
      }
    });
  }

  // -------------------------------------------------------------- PDF

  /**
   * El reporte en PDF.
   *
   * El armado —marca, filtros, tarjetas, tabla, pie— vive en ReportePdf y lo
   * comparten todos los reportes: acá solo se decide qué va en cada parte. Si
   * cada pantalla dibujara lo suyo, en un mes habría cinco variantes y un
   * margen corregido en una sola.
   */
  descargarPDF(): void {
    const pdf = new ReportePdf('landscape');

    pdf.cabecera({
      reporte: 'Órdenes de pago y rendiciones',
      empresa: this.codEmpresa,
      usuario: this.usuarioActual
    }).filtros(this.chipsDeFiltros());

    pdf.tarjetas([
      { rotulo: 'ÓRDENES', valor: String(this.totalOrdenes),
        pie: 'S/ ' + nro(this.totalEntregado) + ' entregados', color: [37, 78, 138] },
      { rotulo: 'SIN RENDIR', valor: String(this.sinRendir),
        pie: 'nadie las empezó', color: [176, 68, 45] },
      { rotulo: 'EN CONTABILIDAD', valor: String(this.enProceso),
        pie: 'enviadas o recepcionadas', color: [176, 132, 24] },
      { rotulo: 'LIQUIDADAS', valor: String(this.liquidadas),
        pie: 'S/ ' + nro(this.totalRendido) + ' rendidos', color: [37, 118, 74] },
    ]);

    const cols: ColumnaPdf[] = [
      { titulo: 'Orden', ancho: 58, alineacion: 'l' },
      { titulo: 'Fecha', ancho: 48, alineacion: 'c' },
      { titulo: 'Personal', ancho: 132, alineacion: 'l' },
      { titulo: 'Centro de costos', ancho: 118, alineacion: 'l' },
      { titulo: 'Mon.', ancho: 30, alineacion: 'c' },
      { titulo: 'Entregado', ancho: 62, alineacion: 'r' },
      { titulo: 'Rendido', ancho: 62, alineacion: 'r' },
      { titulo: 'Saldo', ancho: 58, alineacion: 'r' },
      { titulo: 'ERP', ancho: 44, alineacion: 'c' },
      { titulo: 'Rend.', ancho: 32, alineacion: 'c' },
      { titulo: 'Estado REGINA', ancho: 78, alineacion: 'c' },
      { titulo: 'Comp.', ancho: 32, alineacion: 'c' },
      { titulo: 'Días', ancho: 32, alineacion: 'c' },
    ];

    const filas = this.filas.map(f => [
      f.numOrden,
      fmtFecha(f.fecOrden),
      (f.desAuxiliar || f.codAuxiliar || '').substring(0, 33),
      (f.desCCostos || f.codCCostos || '').substring(0, 30),
      f.desMoneda || '',
      nro(f.impOrdPago),
      nro(f.impRendido),
      nro(f.saldo),
      f.desEstado || '',
      f.tieneRendicion ? 'Sí' : 'No',
      f.etiquetaProceso || '',
      String(f.comprobantes ?? 0),
      f.diasSinRendir == null ? '' : String(f.diasSinRendir),
    ]);

    pdf.seccion('Detalle por orden de pago')
       .tabla(cols, filas, [
         'TOTAL', '', String(this.totalOrdenes) + ' órdenes', '', '',
         nro(this.totalEntregado), nro(this.totalRendido), nro(this.totalSaldo)
       ]);

    pdf.guardar(`ordenes_y_rendiciones_${this.aISO(new Date())}.pdf`);
  }

  /** Los filtros aplicados, tal como se imprimen arriba del reporte. */
  private chipsDeFiltros(): string[] {
    const c: string[] = [];
    if (this.filtro.desde) { c.push(`desde: ${this.filtro.desde}`); }
    if (this.filtro.hasta) { c.push(`hasta: ${this.filtro.hasta}`); }
    if (this.filtro.numOrden) { c.push(`orden: ${this.filtro.numOrden}`); }
    if (this.filtro.persona) { c.push(`personal: ${this.filtro.persona}`); }
    if (this.filtro.codCCostos) { c.push(`centro: ${this.filtro.codCCostos}`); }
    if (this.filtro.tipEstado) {
      c.push(`estado ERP: ${this.etiqueta(this.estadosErp, this.filtro.tipEstado)}`);
    }
    if (this.filtro.situacion) {
      c.push(`rendición: ${this.etiqueta(this.situaciones, this.filtro.situacion)}`);
    }
    if (this.filtro.estProceso) {
      c.push(`estado REGINA: ${this.etiqueta(this.estadosRegina, this.filtro.estProceso)}`);
    }
    return c;
  }

  private etiqueta(lista: { valor: string; etiqueta: string }[], valor: string): string {
    return lista.find(x => x.valor === valor)?.etiqueta ?? valor;
  }
}
