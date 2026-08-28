import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';

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
   * El PDF con el armado de la casa: marca, parámetros usados, tarjetas de
   * resumen y la tabla.
   *
   * Los parámetros van impresos a propósito. Un PDF que circula por correo sin
   * decir con qué filtros salió no se puede volver a citar dos semanas después,
   * y alguien termina discutiendo dos cifras que respondían a preguntas
   * distintas.
   */
  descargarPDF(): void {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();
    const margen = 28;

    // Cada color como tres numeros sueltos: jsPDF tipa setFillColor con
    // sobrecargas y un spread de tupla no siempre resuelve la correcta.
    const AZUL_R = 37, AZUL_G = 78, AZUL_B = 138;
    const GRIS_R = 110, GRIS_G = 118, GRIS_B = 130;
    const LIN_R = 222, LIN_G = 226, LIN_B = 232;

    let y = margen;

    // ---------------------------------------------------------- marca
    doc.setFillColor(AZUL_R, AZUL_G, AZUL_B);
    doc.roundedRect(margen, y, 26, 26, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('R', margen + 9, y + 18);

    doc.setTextColor(AZUL_R, AZUL_G, AZUL_B);
    doc.setFontSize(15);
    doc.text('REGINA', margen + 34, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(GRIS_R, GRIS_G, GRIS_B);
    doc.text('Rendición de cuentas', margen + 34, y + 22);

    const derecha = ancho - margen;
    doc.setFontSize(8);
    const cabeceraDerecha = [
      ['Reporte: ', 'Órdenes de pago y rendiciones'],
      ['Empresa: ', this.codEmpresa],
      ['Generado: ', new Date().toLocaleString('es-PE')],
      ['Usuario: ', this.usuarioActual || '—'],
    ];
    cabeceraDerecha.forEach((par, i) => {
      const linY = y + 6 + i * 10;
      doc.setTextColor(GRIS_R, GRIS_G, GRIS_B);
      const valorAncho = doc.getTextWidth(par[1]);
      doc.text(par[0], derecha - valorAncho - doc.getTextWidth(par[0]), linY);
      doc.setTextColor(40, 44, 52);
      doc.setFont('helvetica', 'bold');
      doc.text(par[1], derecha - valorAncho, linY);
      doc.setFont('helvetica', 'normal');
    });

    y += 40;
    doc.setDrawColor(AZUL_R, AZUL_G, AZUL_B);
    doc.setLineWidth(1);
    doc.line(margen, y, derecha, y);
    y += 16;

    // ----------------------------------------------------- parámetros
    const chips = this.chipsDeFiltros();
    let x = margen;
    doc.setFontSize(7.5);
    for (const chip of chips) {
      const w = doc.getTextWidth(chip) + 14;
      if (x + w > derecha) { x = margen; y += 18; }
      doc.setFillColor(243, 245, 248);
      doc.roundedRect(x, y - 9, w, 15, 7, 7, 'F');
      doc.setTextColor(70, 78, 92);
      doc.text(chip, x + 7, y + 1);
      x += w + 6;
    }
    y += 24;

    // -------------------------------------------------------- tarjetas
    const tarjetas: Array<{ rot: string; valor: string; r: number; g: number; b: number }> = [
      { rot: 'ÓRDENES',    valor: String(this.totalOrdenes), r: AZUL_R, g: AZUL_G, b: AZUL_B },
      { rot: 'SIN RENDIR', valor: String(this.sinRendir),    r: 176, g: 68,  b: 45 },
      { rot: 'EN PROCESO', valor: String(this.enProceso),    r: 176, g: 132, b: 24 },
      { rot: 'LIQUIDADAS', valor: String(this.liquidadas),   r: 37,  g: 118, b: 74 },
    ];
    const anchoT = (derecha - margen - 3 * 10) / 4;
    tarjetas.forEach((t, i) => {
      const tx = margen + i * (anchoT + 10);
      doc.setDrawColor(LIN_R, LIN_G, LIN_B);
      doc.setLineWidth(0.6);
      doc.roundedRect(tx, y, anchoT, 40, 3, 3, 'S');
      doc.setFillColor(t.r, t.g, t.b);
      doc.rect(tx, y, anchoT, 2.5, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(GRIS_R, GRIS_G, GRIS_B);
      doc.text(t.rot, tx + 10, y + 16);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(t.r, t.g, t.b);
      doc.text(t.valor, tx + 10, y + 34);
      doc.setFont('helvetica', 'normal');
    });
    y += 54;

    doc.setFillColor(AZUL_R, AZUL_G, AZUL_B);
    doc.rect(margen, y - 8, 3, 11, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(AZUL_R, AZUL_G, AZUL_B);
    doc.text('Detalle por orden de pago', margen + 9, y);
    doc.setFont('helvetica', 'normal');
    y += 12;

    // ----------------------------------------------------------- tabla
    const cols: Array<[string, number, 'l' | 'r' | 'c']> = [
      ['Orden', 58, 'l'],
      ['Fecha', 48, 'c'],
      ['Personal', 170, 'l'],
      ['CC', 50, 'l'],
      ['Mon.', 30, 'c'],
      ['Entregado', 62, 'r'],
      ['Rendido', 62, 'r'],
      ['Saldo', 58, 'r'],
      ['ERP', 44, 'c'],
      ['Rend.', 32, 'c'],
      ['Estado REGINA', 78, 'c'],
      ['Comp.', 32, 'c'],
      ['Días', 32, 'c'],
    ];

    const dibujarCabecera = (yy: number): number => {
      doc.setFillColor(AZUL_R, AZUL_G, AZUL_B);
      doc.rect(margen, yy, derecha - margen, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      let cx = margen;
      for (const [titulo, w, al] of cols) {
        this.texto(doc, titulo, cx, yy + 11, w, al);
        cx += w;
      }
      doc.setFont('helvetica', 'normal');
      return yy + 16;
    };

    y = dibujarCabecera(y);

    doc.setFontSize(6.8);
    let impar = false;

    for (const f of this.filas) {
      if (y > alto - 60) {
        doc.addPage();
        y = margen;
        y = dibujarCabecera(y);
        doc.setFontSize(6.8);
      }

      if (impar) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margen, y, derecha - margen, 13, 'F');
      }
      impar = !impar;

      const celdas: string[] = [
        f.numOrden,
        f.fecOrden ? new Date(f.fecOrden).toLocaleDateString('es-PE') : '',
        (f.desAuxiliar || f.codAuxiliar || '').substring(0, 42),
        (f.codCCostos || ''),
        (f.desMoneda || ''),
        this.numero(f.impOrdPago),
        this.numero(f.impRendido),
        this.numero(f.saldo),
        (f.desEstado || ''),
        f.tieneRendicion ? 'Sí' : 'No',
        (f.etiquetaProceso || ''),
        String(f.comprobantes ?? 0),
        f.diasSinRendir == null ? '' : String(f.diasSinRendir),
      ];

      let cx = margen;
      doc.setTextColor(40, 44, 52);
      celdas.forEach((v, i) => {
        const [, w, al] = cols[i];
        if (i === 9 && v === 'No') { doc.setTextColor(176, 68, 45); }
        this.texto(doc, v, cx, y + 9, w, al);
        doc.setTextColor(40, 44, 52);
        cx += w;
      });

      doc.setDrawColor(LIN_R, LIN_G, LIN_B);
      doc.setLineWidth(0.3);
      doc.line(margen, y + 13, derecha, y + 13);
      y += 13;
    }

    // ------------------------------------------------------------ total
    if (y > alto - 50) { doc.addPage(); y = margen; }
    doc.setFillColor(232, 239, 249);
    doc.rect(margen, y, derecha - margen, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(AZUL_R, AZUL_G, AZUL_B);
    let cx = margen;
    const totales = ['TOTAL', '', String(this.totalOrdenes) + ' órdenes', '', '',
                     this.numero(this.totalEntregado), this.numero(this.totalRendido),
                     this.numero(this.totalSaldo), '', '', '', '', ''];
    totales.forEach((v, i) => {
      const [, w, al] = cols[i];
      this.texto(doc, v, cx, y + 11, w, al);
      cx += w;
    });
    doc.setFont('helvetica', 'normal');

    // -------------------------------------------------------------- pie
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(GRIS_R, GRIS_G, GRIS_B);
      doc.text(`Página ${i} de ${paginas}`, ancho / 2, alto - 18, { align: 'center' });
    }

    doc.save(`ordenes_y_rendiciones_${this.aISO(new Date())}.pdf`);
  }

  /** Los filtros aplicados, tal como se van a imprimir arriba del reporte. */
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
    if (!c.length) { c.push('sin filtros: todas las órdenes'); }
    return c;
  }

  private etiqueta(lista: { valor: string; etiqueta: string }[], valor: string): string {
    return lista.find(x => x.valor === valor)?.etiqueta ?? valor;
  }

  private numero(v?: number): string {
    return (v ?? 0).toLocaleString('es-PE', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  /** Escribe dentro de una columna respetando su alineación. */
  private texto(doc: jsPDF, valor: string, x: number, y: number,
                ancho: number, alineacion: 'l' | 'r' | 'c'): void {
    if (alineacion === 'r') {
      doc.text(valor, x + ancho - 5, y, { align: 'right' });
    } else if (alineacion === 'c') {
      doc.text(valor, x + ancho / 2, y, { align: 'center' });
    } else {
      doc.text(valor, x + 5, y);
    }
  }
}
