import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import jsPDF from 'jspdf';

import { OrdenPagoService } from './orden-pago.service';
import { OrdenPagoDetService } from './orden-pago-det.service';
import { OrdenPagoPlanillaMovilidadCabService } from './orden-pago-planilla-movilidad-cab.service';
import { OrdenPagoPlanillaMovilidadDetService } from './orden-pago-planilla-movilidad-det.service';

import { OrdenPago } from '../models/orden-pago';
import { OrdenPagoDetDTO } from '../models/orden-pago-det';
import { OrdenPagoCabPlanilla } from '../models/orden-pago-planilla-movilidad-cab';
import { OrdenPagoPlanillaMovilidadDet } from '../models/orden-pago-planilla-movilidad-det';

import { WrapperRequestOrdenPago } from '../models/wrappers/wrapper-request-orden-pago';
import { WrapperRequestOrdenPagoDet } from '../models/wrappers/wrapper-request-orden-pago-det';
import { WrapperRequestPlanillaMovilidadCab } from '../models/wrappers/wrapper-request-planilla-movilidad-cab';
import { Response } from '../models/response';

type RGB = [number, number, number];

interface PaletteSpec {
  primary: RGB;
  primaryDk: RGB;
  darkText: RGB;
  grayText: RGB;
  light: RGB;
  border: RGB;
  success: RGB;
  warning: RGB;
  danger: RGB;
  info: RGB;
  whiteText: RGB;
}

interface UserCtx {
  isAdmin: boolean;
  codAuxiliar: string;
  codEmpresa: string;
  codSucursal: string;
  nombre: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {

  private palette: PaletteSpec = {
    primary:    [25, 118, 210],
    primaryDk:  [13, 71, 161],
    darkText:   [33, 37, 41],
    grayText:   [107, 114, 128],
    light:      [243, 244, 246],
    border:     [209, 213, 219],
    success:    [34, 139, 34],
    warning:    [245, 158, 11],
    danger:     [198, 40, 40],
    info:       [14, 165, 233],
    whiteText:  [255, 255, 255]
  };

  constructor(
    private opService: OrdenPagoService,
    private opDetService: OrdenPagoDetService,
    private planillaCabService: OrdenPagoPlanillaMovilidadCabService,
    private planillaDetService: OrdenPagoPlanillaMovilidadDetService
  ) {}

  /* =====================================================
     CONTEXTO USUARIO
  ===================================================== */
  private getUserCtx(): UserCtx {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || '{}');
      const nombre = [u.userLastName, u.userMiddleName, u.userName].filter(Boolean).join(' ').trim();
      return {
        isAdmin: !!u.userAdmin,
        codAuxiliar: u.codAuxiliar || '',
        codEmpresa: u.codEmpresa || '',
        codSucursal: u.codSucursal || '',
        nombre: nombre || 'Sin nombre',
        username: u.userUsername || ''
      };
    } catch {
      return { isAdmin: false, codAuxiliar: '', codEmpresa: '', codSucursal: '', nombre: '', username: '' };
    }
  }

  private cargarOrdenes(): Observable<OrdenPago[]> {
    const u = this.getUserCtx();
    const wrapper = new WrapperRequestOrdenPago();
    wrapper.codAuxiliar = u.codAuxiliar;
    wrapper.codEmpresa = u.codEmpresa;
    wrapper.codSucursal = u.codSucursal;
    wrapper.isAdmin = u.isAdmin;
    return this.opService.getOrdenesPago(wrapper).pipe(
      map((r: Response) => (r?.resultado as OrdenPago[]) || []),
      catchError(() => of([] as OrdenPago[]))
    );
  }

  /* =====================================================
     HELPERS PDF (compartidos)
  ===================================================== */
  private newDoc(orientation: 'p' | 'l' = 'p'): jsPDF {
    return new jsPDF(orientation, 'mm', 'a4');
  }

  private pageMetrics(doc: jsPDF) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const marginX = 14;
    return { w, h, marginX, usableW: w - marginX * 2 };
  }

  private drawHeader(doc: jsPDF, titulo: string, subtitulo: string): void {
    const { w, marginX } = this.pageMetrics(doc);
    doc.setFillColor(...this.palette.primary);
    doc.rect(0, 0, w, 28, 'F');
    doc.setFillColor(...this.palette.primaryDk);
    doc.rect(0, 28, w, 2, 'F');

    doc.setTextColor(...this.palette.whiteText);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('REGINA · Aquarius Consulting', marginX, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(titulo, marginX, 21);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(subtitulo, w - marginX, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Emitido: ${this.formatDateLong(new Date())}`, w - marginX, 21, { align: 'right' });
  }

  private drawFooter(doc: jsPDF, pagActual: number, pagTotal: number, fechaImp: string): void {
    const { w, h, marginX } = this.pageMetrics(doc);
    const yLine = h - 18;

    doc.setDrawColor(...this.palette.border);
    doc.setLineWidth(0.3);
    doc.line(marginX, yLine, w - marginX, yLine);

    doc.setFontSize(7.5);
    doc.setTextColor(...this.palette.grayText);
    doc.setFont('helvetica', 'normal');
    doc.text('Documento generado automáticamente por el Sistema Regina · Confidencial · Uso interno', marginX, yLine + 5);
    doc.text('Aquarius Consulting · soporte@aquariusconsulting.pe', marginX, yLine + 9);

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${pagActual} de ${pagTotal}`, w - marginX, yLine + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(fechaImp, w - marginX, yLine + 9, { align: 'right' });
  }

  private finalizarFooters(doc: jsPDF, fechaImp: string): void {
    const totalPag = (doc as any).getNumberOfPages
      ? (doc as any).getNumberOfPages()
      : doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPag; i++) {
      doc.setPage(i);
      this.drawFooter(doc, i, totalPag, fechaImp);
    }
  }

  private ensureSpace(doc: jsPDF, y: number, needed: number, ctx: { y: number, redibujarHeader: () => void }): number {
    const { h } = this.pageMetrics(doc);
    if (y + needed > h - 28) {
      doc.addPage();
      ctx.redibujarHeader();
      ctx.y = 36;
      return ctx.y;
    }
    return y;
  }

  private sectionTitle(doc: jsPDF, text: string, y: number, ctx: { y: number, redibujarHeader: () => void }): number {
    const { marginX, usableW } = this.pageMetrics(doc);
    y = this.ensureSpace(doc, y, 14, ctx);
    doc.setFillColor(...this.palette.primary);
    doc.rect(marginX, y, usableW, 7, 'F');
    doc.setTextColor(...this.palette.whiteText);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(text, marginX + 3, y + 5);
    return y + 11;
  }

  private drawTable(
    doc: jsPDF,
    headers: string[],
    rows: string[][],
    colWidths: number[],
    y: number,
    ctx: { y: number, redibujarHeader: () => void },
    align: ('L' | 'R' | 'C')[] = []
  ): number {
    const { marginX, usableW } = this.pageMetrics(doc);
    const rowH = 6;
    y = this.ensureSpace(doc, y, rowH + 6, ctx);

    // header
    doc.setFillColor(...this.palette.primaryDk);
    doc.rect(marginX, y, usableW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...this.palette.whiteText);
    let cx = marginX;
    headers.forEach((h, i) => {
      const a = align[i] || 'L';
      const tx = a === 'R' ? cx + colWidths[i] - 2 : a === 'C' ? cx + colWidths[i] / 2 : cx + 2;
      doc.text(h, tx, y + 4, { align: a === 'R' ? 'right' : a === 'C' ? 'center' : 'left' });
      cx += colWidths[i];
    });
    y += rowH;

    // body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    if (rows.length === 0) {
      y = this.ensureSpace(doc, y, 10, ctx);
      doc.setFillColor(...this.palette.light);
      doc.rect(marginX, y, usableW, 8, 'F');
      doc.setTextColor(...this.palette.grayText);
      doc.setFont('helvetica', 'italic');
      doc.text('Sin registros para mostrar.', marginX + usableW / 2, y + 5, { align: 'center' });
      return y + 10;
    }

    rows.forEach((row, idx) => {
      const lines = row.map((cell, i) =>
        doc.splitTextToSize(cell || '—', colWidths[i] - 4)
      );
      const linesMax = Math.max(...lines.map((l: string[]) => l.length));
      const rowHeight = Math.max(rowH, linesMax * 4 + 2);

      y = this.ensureSpace(doc, y, rowHeight + 2, ctx);

      if (idx % 2 === 1) {
        doc.setFillColor(...this.palette.light);
        doc.rect(marginX, y, usableW, rowHeight, 'F');
      }

      cx = marginX;
      row.forEach((cell, i) => {
        const a = align[i] || 'L';
        doc.setTextColor(...this.palette.darkText);
        const tx = a === 'R' ? cx + colWidths[i] - 2 : a === 'C' ? cx + colWidths[i] / 2 : cx + 2;
        doc.text(lines[i], tx, y + 4, { align: a === 'R' ? 'right' : a === 'C' ? 'center' : 'left' });
        cx += colWidths[i];
      });
      y += rowHeight;
    });

    return y + 2;
  }

  private drawKpiBoxes(doc: jsPDF, kpis: { label: string, value: string, color?: RGB }[], y: number, ctx: { y: number, redibujarHeader: () => void }): number {
    const { marginX, usableW } = this.pageMetrics(doc);
    const cols = Math.min(kpis.length, 4);
    const w = (usableW - (cols - 1) * 4) / cols;
    const h = 22;

    y = this.ensureSpace(doc, y, h + 4, ctx);

    let row = 0;
    let col = 0;
    kpis.forEach((kpi) => {
      const x = marginX + col * (w + 4);
      const yy = y + row * (h + 4);
      const color = kpi.color || this.palette.primary;
      doc.setFillColor(...color);
      doc.rect(x, yy, w, h, 'F');
      doc.setTextColor(...this.palette.whiteText);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(kpi.label, x + w / 2, yy + 7, { align: 'center' });
      doc.setFontSize(13);
      doc.text(kpi.value, x + w / 2, yy + 16, { align: 'center' });

      col++;
      if (col >= cols) { col = 0; row++; }
    });

    return y + (row + 1) * (h + 4);
  }

  private drawSignature(doc: jsPDF, y: number, ctx: { y: number, redibujarHeader: () => void }, nombre: string, sub: string): number {
    const { marginX, usableW, h } = this.pageMetrics(doc);
    y = this.ensureSpace(doc, y, 56, ctx);
    y += 6;

    const firmaW = (usableW - 16) / 2;
    const drawFirma = (x: number, titulo: string, subtitulo: string) => {
      doc.setDrawColor(...this.palette.darkText);
      doc.setLineWidth(0.4);
      doc.line(x + 5, y + 28, x + firmaW - 5, y + 28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...this.palette.darkText);
      doc.text(titulo, x + firmaW / 2, y + 33, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...this.palette.grayText);
      doc.text(subtitulo, x + firmaW / 2, y + 38, { align: 'center' });

      doc.setDrawColor(...this.palette.border);
      doc.setLineWidth(0.2);
      doc.rect(x, y, firmaW, 42);
    };

    drawFirma(marginX, nombre.toUpperCase(), sub);
    drawFirma(marginX + firmaW + 16, 'V° B° SUPERVISOR', 'Aprobación / Conformidad');

    return y + 50;
  }

  private salvarYAbrir(doc: jsPDF, filename: string): void {
    doc.save(filename);
    try {
      const blob = doc.output('blob') as Blob;
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      console.warn('No se pudo abrir vista previa', e);
    }
  }

  /* =====================================================
     FORMATEO
  ===================================================== */
  private fmt(n?: number | null): string {
    const v = typeof n === 'number' ? n : 0;
    return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatDate(d?: Date | string | null): string {
    if (!d) return '—';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
  }

  private formatDateLong(d: Date): string {
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private estadoLabel(s?: string): string {
    switch (s) {
      case 'EM': return 'Emitida';
      case 'PE': return 'Pendiente';
      case 'LQ': return 'Liquidada';
      case 'PR': return 'Procesada';
      default:   return s || '—';
    }
  }

  /* =====================================================
     1) REPORTE: PLANILLAS DE MOVILIDAD
  ===================================================== */
  reportePlanillasMovilidad(): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      this.cargarOrdenes().subscribe(ordenes => {

        const calls = ordenes.map(op => {
          const w = new WrapperRequestPlanillaMovilidadCab();
          w.codEmpresa = op.codEmpresa;
          w.codSucursal = op.codSucursal;
          w.anioPeriodo = op.anoPeriodo;
          w.codPeriodo = op.codPeriodo;
          w.numOrden = op.numOrden;

          return this.planillaCabService.getPlanillaMovilidad(w).pipe(
            map((r: Response) => ({
              op,
              cabs: (r?.resultado as OrdenPagoCabPlanilla[]) || []
            })),
            catchError(() => of({ op, cabs: [] as OrdenPagoCabPlanilla[] }))
          );
        });

        if (calls.length === 0) {
          this.construirPDFPlanillas([]);
          subscriber.next(true); subscriber.complete();
          return;
        }

        forkJoin(calls).subscribe(grupos => {
          // Para cada planilla cargar su detalle
          const detalleCalls: Observable<{ op: OrdenPago, cab: OrdenPagoCabPlanilla, det: OrdenPagoPlanillaMovilidadDet[] }>[] = [];
          grupos.forEach(g => {
            g.cabs.forEach(c => {
              detalleCalls.push(
                this.planillaDetService.listarDetalle(
                  c.codEmpresa || '', c.codSucursal || '',
                  c.anioPeriodo || '', c.codPeriodo || '',
                  c.numOrden || '', c.codPlanilla || ''
                ).pipe(
                  map((r: Response) => ({
                    op: g.op, cab: c,
                    det: (r?.resultado as OrdenPagoPlanillaMovilidadDet[]) || []
                  })),
                  catchError(() => of({ op: g.op, cab: c, det: [] as OrdenPagoPlanillaMovilidadDet[] }))
                )
              );
            });
          });

          if (detalleCalls.length === 0) {
            this.construirPDFPlanillas([]);
            subscriber.next(true); subscriber.complete();
            return;
          }

          forkJoin(detalleCalls).subscribe(planillas => {
            this.construirPDFPlanillas(planillas);
            subscriber.next(true); subscriber.complete();
          });
        });
      });
    });
  }

  private construirPDFPlanillas(planillas: { op: OrdenPago, cab: OrdenPagoCabPlanilla, det: OrdenPagoPlanillaMovilidadDet[] }[]): void {
    const u = this.getUserCtx();
    const doc = this.newDoc('p');
    const fechaImp = this.formatDateLong(new Date());

    const redibujar = () => this.drawHeader(doc, 'REPORTE DE PLANILLAS DE MOVILIDAD', u.isAdmin ? 'Vista Global' : `Usuario: ${u.username}`);
    redibujar();

    let y = 36;
    const ctx = { y, redibujarHeader: redibujar };

    // KPIs
    const totalPlanillas = planillas.length;
    const totalRecibido = planillas.reduce((a, p) => a + (p.cab.recibido ?? 0), 0);
    const totalGastado = planillas.reduce((a, p) => a + p.det.reduce((b, d) => b + (d.importe ?? 0), 0), 0);
    const totalDevolucion = planillas.reduce((a, p) => a + (p.cab.devolucion ?? 0), 0);
    const totalViajes = planillas.reduce((a, p) => a + p.det.length, 0);

    y = this.sectionTitle(doc, '1. RESUMEN GENERAL', y, ctx);
    y = this.drawKpiBoxes(doc, [
      { label: 'PLANILLAS', value: String(totalPlanillas), color: this.palette.primary },
      { label: 'TOTAL VIAJES', value: String(totalViajes), color: this.palette.info },
      { label: 'RECIBIDO', value: this.fmt(totalRecibido), color: this.palette.success },
      { label: 'GASTADO', value: this.fmt(totalGastado), color: this.palette.warning },
    ], y, ctx);

    y += 4;

    // Detalle planillas
    y = this.sectionTitle(doc, '2. DETALLE DE PLANILLAS', y, ctx);

    if (planillas.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...this.palette.grayText);
      doc.text('No se encontraron planillas registradas.', 14, y + 4);
    } else {
      planillas.forEach((p, idx) => {
        const { marginX, usableW } = this.pageMetrics(doc);
        y = this.ensureSpace(doc, y, 22, ctx);

        // sub-cabecera planilla
        doc.setFillColor(...this.palette.primary);
        doc.rect(marginX, y, usableW, 6, 'F');
        doc.setTextColor(...this.palette.whiteText);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`OP ${p.op.numOrden || '-'} · Planilla N° ${p.cab.codPlanilla || (idx + 1)} · ${this.formatDate(p.cab.fechaPlanilla)}`, marginX + 2, y + 4);
        doc.text(`${this.fmt(p.cab.recibido ?? 0)} S/`, p.op.codEmpresa ? p.op.codEmpresa.length + 0 : 0, 0); // dummy para evitar warning
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const benef = p.op.cdesAuxiliar || p.op.codAuxiliar || '—';
        doc.text(benef, this.pageMetrics(doc).w - marginX - 2, y + 4, { align: 'right' });
        y += 8;

        // Tabla viajes
        const headers = ['#', 'Fecha', 'Origen', 'Destino', 'Ocupantes', 'Glosa', 'Importe'];
        const widths = [8, 22, 28, 28, 22, usableW - (8 + 22 + 28 + 28 + 22 + 26), 26];
        const aligns: ('L' | 'R' | 'C')[] = ['C', 'C', 'L', 'L', 'C', 'L', 'R'];
        const rows = p.det.map((d, i) => [
          String(i + 1),
          this.formatDate(d.fecItemPlanilla),
          d.codOrigen || '',
          d.codDestino || '',
          d.ocupantes || '',
          d.glosa || '',
          this.fmt(d.importe)
        ]);

        y = this.drawTable(doc, headers, rows, widths, y, ctx, aligns);

        // sub-total
        const subTot = p.det.reduce((a, d) => a + (d.importe ?? 0), 0);
        y = this.ensureSpace(doc, y, 7, ctx);
        doc.setFillColor(...this.palette.darkText);
        doc.rect(marginX, y, usableW, 5.5, 'F');
        doc.setTextColor(...this.palette.whiteText);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(`Total Planilla N° ${p.cab.codPlanilla || (idx + 1)}`, marginX + 2, y + 4);
        doc.text(this.fmt(subTot), this.pageMetrics(doc).w - marginX - 2, y + 4, { align: 'right' });
        y += 9;
      });
    }

    y = this.drawSignature(doc, y, ctx, u.nombre, `Usuario: ${u.username || '—'}`);

    this.finalizarFooters(doc, fechaImp);
    this.salvarYAbrir(doc, `Reporte_Planillas_Movilidad_${Date.now()}.pdf`);
  }

  /* =====================================================
     2) REPORTE: CUMPLIMIENTO DE RENDICIÓN
  ===================================================== */
  reporteCumplimiento(): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      this.cargarOrdenes().subscribe(ordenes => {
        this.construirPDFCumplimiento(ordenes);
        subscriber.next(true); subscriber.complete();
      });
    });
  }

  private construirPDFCumplimiento(ordenes: OrdenPago[]): void {
    const u = this.getUserCtx();
    const doc = this.newDoc('p');
    const fechaImp = this.formatDateLong(new Date());

    const redibujar = () => this.drawHeader(doc, 'REPORTE DE CUMPLIMIENTO DE RENDICIÓN', u.isAdmin ? 'Vista Global' : `Usuario: ${u.username}`);
    redibujar();

    let y = 36;
    const ctx = { y, redibujarHeader: redibujar };

    const importeTotal = ordenes.reduce((a, o) => a + (o.impOrdPago ?? 0), 0);
    const rendidoTotal = ordenes.reduce((a, o) => a + ((o.impRendidoSoles ?? 0) + (o.impRendidoDolares ?? 0)), 0);
    const porRendir = Math.max(0, importeTotal - rendidoTotal);
    const cumplimiento = importeTotal > 0 ? (rendidoTotal / importeTotal) * 100 : 0;

    y = this.sectionTitle(doc, '1. INDICADORES GLOBALES', y, ctx);
    y = this.drawKpiBoxes(doc, [
      { label: 'IMPORTE TOTAL',   value: this.fmt(importeTotal), color: this.palette.primaryDk },
      { label: 'RENDIDO',         value: this.fmt(rendidoTotal), color: this.palette.success },
      { label: 'POR RENDIR',      value: this.fmt(porRendir),    color: this.palette.danger },
      { label: '% CUMPLIMIENTO',  value: `${cumplimiento.toFixed(1)}%`, color: cumplimiento >= 80 ? this.palette.success : cumplimiento >= 50 ? this.palette.warning : this.palette.danger }
    ], y, ctx);

    y += 4;

    // Por estado
    y = this.sectionTitle(doc, '2. CUMPLIMIENTO POR ESTADO', y, ctx);
    const estados = ['EM', 'PE', 'LQ', 'PR'];
    const estadoRows = estados.map(e => {
      const ops = ordenes.filter(o => o.tipEstado === e);
      const imp = ops.reduce((a, o) => a + (o.impOrdPago ?? 0), 0);
      const ren = ops.reduce((a, o) => a + ((o.impRendidoSoles ?? 0) + (o.impRendidoDolares ?? 0)), 0);
      const cum = imp > 0 ? (ren / imp) * 100 : 0;
      return [
        e,
        this.estadoLabel(e),
        String(ops.length),
        this.fmt(imp),
        this.fmt(ren),
        this.fmt(Math.max(0, imp - ren)),
        `${cum.toFixed(1)}%`
      ];
    });
    const { usableW } = this.pageMetrics(doc);
    const wEst = [12, 30, 18, 30, 30, 30, usableW - (12 + 30 + 18 + 30 + 30 + 30)];
    y = this.drawTable(doc,
      ['Cód.', 'Estado', 'Cant.', 'Importe', 'Rendido', 'Por Rendir', '% Cumpl.'],
      estadoRows, wEst, y, ctx,
      ['C', 'L', 'C', 'R', 'R', 'R', 'R']);

    y += 4;

    // Por beneficiario (admin) o resumen propio
    if (u.isAdmin) {
      y = this.sectionTitle(doc, '3. CUMPLIMIENTO POR BENEFICIARIO (TOP 20)', y, ctx);
      const benefMap: { [k: string]: { imp: number, ren: number, cant: number, label: string } } = {};
      ordenes.forEach(o => {
        const k = o.codAuxiliar || 'SIN';
        const label = o.cdesAuxiliar || o.codAuxiliar || 'Sin asignar';
        if (!benefMap[k]) benefMap[k] = { imp: 0, ren: 0, cant: 0, label };
        benefMap[k].imp += (o.impOrdPago ?? 0);
        benefMap[k].ren += (o.impRendidoSoles ?? 0) + (o.impRendidoDolares ?? 0);
        benefMap[k].cant += 1;
      });

      const benRows = Object.values(benefMap)
        .sort((a, b) => b.imp - a.imp)
        .slice(0, 20)
        .map(b => {
          const cum = b.imp > 0 ? (b.ren / b.imp) * 100 : 0;
          return [
            b.label,
            String(b.cant),
            this.fmt(b.imp),
            this.fmt(b.ren),
            this.fmt(Math.max(0, b.imp - b.ren)),
            `${cum.toFixed(1)}%`
          ];
        });

      const wBen = [usableW - (18 + 32 + 32 + 32 + 22), 18, 32, 32, 32, 22];
      y = this.drawTable(doc,
        ['Beneficiario', 'Cant.', 'Importe', 'Rendido', 'Por Rendir', '% Cumpl.'],
        benRows, wBen, y, ctx,
        ['L', 'C', 'R', 'R', 'R', 'R']);
    }

    y = this.drawSignature(doc, y, ctx, u.nombre, `Usuario: ${u.username || '—'}`);
    this.finalizarFooters(doc, fechaImp);
    this.salvarYAbrir(doc, `Reporte_Cumplimiento_${Date.now()}.pdf`);
  }

  /* =====================================================
     3) REPORTE: CENTRO DE COSTOS
  ===================================================== */
  reporteCentroCostos(): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      this.cargarOrdenes().subscribe(ordenes => {
        this.construirPDFCentroCostos(ordenes);
        subscriber.next(true); subscriber.complete();
      });
    });
  }

  private construirPDFCentroCostos(ordenes: OrdenPago[]): void {
    const u = this.getUserCtx();
    const doc = this.newDoc('p');
    const fechaImp = this.formatDateLong(new Date());
    const redibujar = () => this.drawHeader(doc, 'REPORTE POR CENTRO DE COSTOS', u.isAdmin ? 'Vista Global' : `Usuario: ${u.username}`);
    redibujar();
    let y = 36;
    const ctx = { y, redibujarHeader: redibujar };

    const ccMap: { [k: string]: { imp: number, ren: number, cant: number } } = {};
    ordenes.forEach(o => {
      const k = o.codCCostos || 'SIN C.C.';
      if (!ccMap[k]) ccMap[k] = { imp: 0, ren: 0, cant: 0 };
      ccMap[k].imp += (o.impOrdPago ?? 0);
      ccMap[k].ren += (o.impRendidoSoles ?? 0) + (o.impRendidoDolares ?? 0);
      ccMap[k].cant += 1;
    });

    const totalImp = Object.values(ccMap).reduce((a, x) => a + x.imp, 0);

    y = this.sectionTitle(doc, '1. RESUMEN', y, ctx);
    y = this.drawKpiBoxes(doc, [
      { label: 'TOTAL C.C.',  value: String(Object.keys(ccMap).length), color: this.palette.primary },
      { label: 'CANT. OPs',   value: String(ordenes.length), color: this.palette.info },
      { label: 'IMPORTE',     value: this.fmt(totalImp),    color: this.palette.primaryDk },
    ], y, ctx);

    y += 4;
    y = this.sectionTitle(doc, '2. DISTRIBUCIÓN POR CENTRO DE COSTOS', y, ctx);

    const sorted = Object.entries(ccMap).sort((a, b) => b[1].imp - a[1].imp);
    const { usableW } = this.pageMetrics(doc);
    const w = [40, 22, usableW - (40 + 22 + 38 + 38 + 22), 38, 38, 22];
    const rows = sorted.map(([cc, v]) => {
      const pct = totalImp > 0 ? (v.imp / totalImp) * 100 : 0;
      return [
        cc, String(v.cant), '',
        this.fmt(v.imp),
        this.fmt(v.ren),
        `${pct.toFixed(1)}%`
      ];
    });

    // Adjust columns - simpler: 5 columns
    const w2 = [40, 22, usableW - (40 + 22 + 40 + 40 + 22), 40, 40, 22];
    const rows2 = sorted.map(([cc, v]) => {
      const pct = totalImp > 0 ? (v.imp / totalImp) * 100 : 0;
      return [
        cc,
        String(v.cant),
        '',
        this.fmt(v.imp),
        this.fmt(v.ren),
        `${pct.toFixed(1)}%`
      ];
    });

    const wReal = [40, 22, usableW - (40 + 22 + 40 + 40 + 24), 40, 40, 24];
    y = this.drawTable(doc,
      ['Centro Costos', 'Cant.', '', 'Importe', 'Rendido', '% Total'],
      rows.map(r => [r[0], r[1], '', r[3], r[4], r[5]]),
      wReal, y, ctx,
      ['L', 'C', 'L', 'R', 'R', 'R']);

    y = this.drawSignature(doc, y, ctx, u.nombre, `Usuario: ${u.username || '—'}`);
    this.finalizarFooters(doc, fechaImp);
    this.salvarYAbrir(doc, `Reporte_CentroCostos_${Date.now()}.pdf`);
  }

  /* =====================================================
     4) REPORTE: BENEFICIARIOS
  ===================================================== */
  reporteBeneficiarios(): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      this.cargarOrdenes().subscribe(ordenes => {
        this.construirPDFBeneficiarios(ordenes);
        subscriber.next(true); subscriber.complete();
      });
    });
  }

  private construirPDFBeneficiarios(ordenes: OrdenPago[]): void {
    const u = this.getUserCtx();
    const doc = this.newDoc('l');  // landscape para más columnas
    const fechaImp = this.formatDateLong(new Date());
    const redibujar = () => this.drawHeader(doc, 'REPORTE POR BENEFICIARIO', u.isAdmin ? 'Vista Global' : `Usuario: ${u.username}`);
    redibujar();
    let y = 36;
    const ctx = { y, redibujarHeader: redibujar };

    const benMap: { [k: string]: { label: string, cant: number, em: number, pe: number, lq: number, pr: number, imp: number, ren: number, vencidas: number } } = {};
    const hoy = new Date();
    ordenes.forEach(o => {
      const k = o.codAuxiliar || 'SIN';
      const label = o.cdesAuxiliar || k;
      if (!benMap[k]) benMap[k] = { label, cant: 0, em: 0, pe: 0, lq: 0, pr: 0, imp: 0, ren: 0, vencidas: 0 };
      const b = benMap[k];
      b.cant += 1;
      b.imp += (o.impOrdPago ?? 0);
      b.ren += (o.impRendidoSoles ?? 0) + (o.impRendidoDolares ?? 0);
      switch (o.tipEstado) {
        case 'EM': b.em++; break;
        case 'PE': b.pe++; break;
        case 'LQ': b.lq++; break;
        case 'PR': b.pr++; break;
      }
      if (o.fecRendicion && (o.tipEstado === 'EM' || o.tipEstado === 'PE')) {
        if (new Date(o.fecRendicion).getTime() < hoy.getTime()) b.vencidas++;
      }
    });

    const sorted = Object.values(benMap).sort((a, b) => b.imp - a.imp);

    y = this.sectionTitle(doc, '1. RESUMEN', y, ctx);
    y = this.drawKpiBoxes(doc, [
      { label: 'BENEFICIARIOS', value: String(sorted.length), color: this.palette.primary },
      { label: 'TOTAL OPs', value: String(ordenes.length), color: this.palette.info },
      { label: 'IMPORTE TOTAL', value: this.fmt(sorted.reduce((a, b) => a + b.imp, 0)), color: this.palette.primaryDk },
      { label: 'RENDIDO TOTAL', value: this.fmt(sorted.reduce((a, b) => a + b.ren, 0)), color: this.palette.success }
    ], y, ctx);

    y += 4;
    y = this.sectionTitle(doc, '2. DETALLE POR BENEFICIARIO', y, ctx);

    const { usableW } = this.pageMetrics(doc);
    const labelW = usableW - (16 + 16 + 16 + 16 + 16 + 38 + 38 + 22);
    const widths = [labelW, 16, 16, 16, 16, 16, 38, 38, 22];
    const rows = sorted.map(b => {
      const cum = b.imp > 0 ? (b.ren / b.imp) * 100 : 0;
      return [
        b.label, String(b.cant),
        String(b.em), String(b.pe), String(b.lq), String(b.pr),
        this.fmt(b.imp), this.fmt(b.ren),
        `${cum.toFixed(1)}%`
      ];
    });

    y = this.drawTable(doc,
      ['Beneficiario', 'OPs', 'EM', 'PE', 'LQ', 'PR', 'Importe', 'Rendido', '% Cumpl.'],
      rows, widths, y, ctx,
      ['L', 'C', 'C', 'C', 'C', 'C', 'R', 'R', 'R']);

    y = this.drawSignature(doc, y, ctx, u.nombre, `Usuario: ${u.username || '—'}`);
    this.finalizarFooters(doc, fechaImp);
    this.salvarYAbrir(doc, `Reporte_Beneficiarios_${Date.now()}.pdf`);
  }

  /* =====================================================
     5) REPORTE: VENCIMIENTOS
  ===================================================== */
  reporteVencimientos(): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      this.cargarOrdenes().subscribe(ordenes => {
        this.construirPDFVencimientos(ordenes);
        subscriber.next(true); subscriber.complete();
      });
    });
  }

  private construirPDFVencimientos(ordenes: OrdenPago[]): void {
    const u = this.getUserCtx();
    const doc = this.newDoc('p');
    const fechaImp = this.formatDateLong(new Date());
    const redibujar = () => this.drawHeader(doc, 'REPORTE DE VENCIMIENTOS', u.isAdmin ? 'Vista Global' : `Usuario: ${u.username}`);
    redibujar();
    let y = 36;
    const ctx = { y, redibujarHeader: redibujar };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const enRiesgo = ordenes.filter(o => (o.tipEstado === 'EM' || o.tipEstado === 'PE') && o.fecRendicion);

    const calcDias = (fec: Date | string | undefined) => {
      if (!fec) return null;
      const d = new Date(fec); d.setHours(0, 0, 0, 0);
      return Math.floor((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    };

    const vencidas = enRiesgo
      .filter(o => (calcDias(o.fecRendicion) ?? 99999) < 0)
      .sort((a, b) => (calcDias(a.fecRendicion) ?? 0) - (calcDias(b.fecRendicion) ?? 0));

    const proximas7 = enRiesgo.filter(o => { const d = calcDias(o.fecRendicion); return d !== null && d >= 0 && d <= 7; });
    const proximas30 = enRiesgo.filter(o => { const d = calcDias(o.fecRendicion); return d !== null && d > 7 && d <= 30; });

    y = this.sectionTitle(doc, '1. INDICADORES', y, ctx);
    y = this.drawKpiBoxes(doc, [
      { label: 'VENCIDAS',           value: String(vencidas.length),    color: this.palette.danger },
      { label: 'VENCEN ≤ 7 DÍAS',    value: String(proximas7.length),   color: this.palette.warning },
      { label: 'VENCEN 8-30 DÍAS',   value: String(proximas30.length),  color: this.palette.info },
      { label: 'EN RIESGO TOTAL',    value: String(vencidas.length + proximas7.length + proximas30.length), color: this.palette.primaryDk }
    ], y, ctx);

    y += 4;
    const { usableW } = this.pageMetrics(doc);

    // Vencidas
    y = this.sectionTitle(doc, '2. ÓRDENES VENCIDAS', y, ctx);
    const wVen = [22, 28, usableW - (22 + 28 + 22 + 26 + 22 + 24), 22, 26, 22, 24];
    const rowsVen = vencidas.map(o => {
      const dias = calcDias(o.fecRendicion);
      return [
        o.numOrden || '—',
        this.formatDate(o.fecOrden),
        o.cdesAuxiliar || o.codAuxiliar || '—',
        o.tipEstado || '—',
        this.formatDate(o.fecRendicion),
        `${Math.abs(dias ?? 0)} d`,
        this.fmt(o.impOrdPago)
      ];
    });
    y = this.drawTable(doc,
      ['N° OP', 'F. Orden', 'Beneficiario', 'Estado', 'F. Rendir', 'Atraso', 'Importe'],
      rowsVen, wVen, y, ctx, ['C', 'C', 'L', 'C', 'C', 'C', 'R']);

    y += 4;

    // Próximas a vencer
    y = this.sectionTitle(doc, '3. PRÓXIMAS A VENCER (≤ 30 DÍAS)', y, ctx);
    const proximas = [...proximas7, ...proximas30].sort((a, b) => (calcDias(a.fecRendicion) ?? 0) - (calcDias(b.fecRendicion) ?? 0));
    const rowsProx = proximas.map(o => {
      const dias = calcDias(o.fecRendicion);
      return [
        o.numOrden || '—',
        this.formatDate(o.fecOrden),
        o.cdesAuxiliar || o.codAuxiliar || '—',
        o.tipEstado || '—',
        this.formatDate(o.fecRendicion),
        `${dias ?? 0} d`,
        this.fmt(o.impOrdPago)
      ];
    });
    y = this.drawTable(doc,
      ['N° OP', 'F. Orden', 'Beneficiario', 'Estado', 'F. Rendir', 'Faltan', 'Importe'],
      rowsProx, wVen, y, ctx, ['C', 'C', 'L', 'C', 'C', 'C', 'R']);

    y = this.drawSignature(doc, y, ctx, u.nombre, `Usuario: ${u.username || '—'}`);
    this.finalizarFooters(doc, fechaImp);
    this.salvarYAbrir(doc, `Reporte_Vencimientos_${Date.now()}.pdf`);
  }

  /* =====================================================
     6) REPORTE: SUNAT (comprobantes detallados de OPs)
  ===================================================== */
  reporteSunat(): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      this.cargarOrdenes().subscribe(ordenes => {
        const calls = ordenes.map(op => {
          const w = new WrapperRequestOrdenPagoDet();
          w.codEmpresa = op.codEmpresa;
          w.codSucursal = op.codSucursal;
          w.numOrden = op.numOrden;
          return this.opDetService.getOrdenesPagoDet(w).pipe(
            map((r: Response) => ({ op, dets: (r?.resultado as OrdenPagoDetDTO[]) || [] })),
            catchError(() => of({ op, dets: [] as OrdenPagoDetDTO[] }))
          );
        });

        if (calls.length === 0) {
          this.construirPDFSunat([]);
          subscriber.next(true); subscriber.complete();
          return;
        }

        forkJoin(calls).subscribe(grupos => {
          const todos: { op: OrdenPago, det: OrdenPagoDetDTO }[] = [];
          grupos.forEach(g => g.dets.forEach(d => todos.push({ op: g.op, det: d })));
          this.construirPDFSunat(todos);
          subscriber.next(true); subscriber.complete();
        });
      });
    });
  }

  private construirPDFSunat(items: { op: OrdenPago, det: OrdenPagoDetDTO }[]): void {
    const u = this.getUserCtx();
    const doc = this.newDoc('l');
    const fechaImp = this.formatDateLong(new Date());
    const redibujar = () => this.drawHeader(doc, 'REPORTE DE COMPROBANTES SUNAT', u.isAdmin ? 'Vista Global' : `Usuario: ${u.username}`);
    redibujar();
    let y = 36;
    const ctx = { y, redibujarHeader: redibujar };

    const totalCompr = items.length;
    const totalSoles = items.filter(i => i.det.codMoneda === '01').reduce((a, i) => a + (i.det.impSoles ?? 0), 0);
    const totalDolares = items.filter(i => i.det.codMoneda === '02').reduce((a, i) => a + (i.det.impDolares ?? 0), 0);

    // Agrupar por proveedor
    const provMap: { [k: string]: { cant: number, importe: number } } = {};
    items.forEach(i => {
      const k = i.det.codAuxiliar || 'SIN PROV.';
      if (!provMap[k]) provMap[k] = { cant: 0, importe: 0 };
      provMap[k].cant += 1;
      provMap[k].importe += (i.det.codMoneda === '01' ? (i.det.impSoles ?? 0) : (i.det.impDolares ?? 0));
    });

    y = this.sectionTitle(doc, '1. RESUMEN GENERAL', y, ctx);
    y = this.drawKpiBoxes(doc, [
      { label: 'COMPROBANTES',  value: String(totalCompr), color: this.palette.primary },
      { label: 'PROVEEDORES',   value: String(Object.keys(provMap).length), color: this.palette.info },
      { label: 'TOTAL S/',      value: this.fmt(totalSoles),   color: this.palette.primaryDk },
      { label: 'TOTAL US$',     value: this.fmt(totalDolares), color: this.palette.success }
    ], y, ctx);

    y += 4;

    // Top proveedores
    y = this.sectionTitle(doc, '2. TOP PROVEEDORES (RUC)', y, ctx);
    const provSorted = Object.entries(provMap).sort((a, b) => b[1].importe - a[1].importe).slice(0, 30);
    const { usableW } = this.pageMetrics(doc);
    const wProv = [50, usableW - (50 + 30 + 40), 30, 40];
    const rowsProv = provSorted.map(([k, v]) => [k, '', String(v.cant), this.fmt(v.importe)]);
    y = this.drawTable(doc, ['RUC / Cód.', '', 'Cant.', 'Importe'], rowsProv, wProv, y, ctx, ['L', 'L', 'C', 'R']);

    y += 4;

    // Detalle de comprobantes
    y = this.sectionTitle(doc, '3. DETALLE DE COMPROBANTES', y, ctx);
    const wDet = [22, 22, 18, 32, 36, usableW - (22 + 22 + 18 + 32 + 36 + 16 + 32), 16, 32];
    const rowsDet = items.map(i => [
      i.op.numOrden || '—',
      this.formatDate(i.det.fecDocumento),
      i.det.codDocumento || '—',
      `${i.det.numSerieDoc || ''}-${i.det.numDocumento || ''}`,
      i.det.codAuxiliar || '—',
      i.det.glosa || '',
      i.det.codMoneda === '01' ? 'S/' : (i.det.codMoneda === '02' ? 'US$' : (i.det.codMoneda || '')),
      this.fmt(i.det.codMoneda === '01' ? i.det.impSoles : i.det.impDolares)
    ]);
    y = this.drawTable(doc,
      ['OP', 'Fecha', 'Doc.', 'Serie-Núm.', 'Proveedor', 'Glosa', 'Mon.', 'Importe'],
      rowsDet, wDet, y, ctx,
      ['C', 'C', 'C', 'C', 'L', 'L', 'C', 'R']);

    y = this.drawSignature(doc, y, ctx, u.nombre, `Usuario: ${u.username || '—'}`);
    this.finalizarFooters(doc, fechaImp);
    this.salvarYAbrir(doc, `Reporte_SUNAT_${Date.now()}.pdf`);
  }
}
