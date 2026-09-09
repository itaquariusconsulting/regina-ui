import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';

import { OrdenPagoCabPlanilla } from '../models/orden-pago-planilla-movilidad-cab';
import { OrdenPagoPlanillaMovilidadDet } from '../models/orden-pago-planilla-movilidad-det';

/** Lo que hace falta para imprimir una planilla en el formato de la empresa. */
export interface DatosPlanillaPdf {
  planilla: OrdenPagoCabPlanilla;
  viajes: OrdenPagoPlanillaMovilidadDet[];
  /** Nombre y apellidos del trabajador. Vacio deja la linea para llenar a mano. */
  nombreTrabajador?: string;
  /** Tope diario que se imprime en la nota del pie. */
  importeMaxDia?: number;
  /** Traduce el codigo de ubigeo a texto. Sin esto se imprime el codigo. */
  ubigeo?: (cod?: string | null) => string;
}

/**
 * El formato oficial de planilla de movilidad (FIN-PR-04-FO-03), en PDF.
 *
 * <p>Vivia dentro de la pantalla de planillas de una orden, que es donde lo
 * usa el que rinde. Contabilidad pidio el mismo papel desde la pantalla de
 * verificacion, que es otra pantalla y no tiene nada que ver con aquella:
 * copiarlo habria dejado dos formatos que se irian separando con el tiempo,
 * y el papel tiene que ser uno solo porque es el que se firma.
 *
 * <p>Dibuja SIEMPRE diez filas de viaje, esten llenas o no. No es un
 * descuido: el formato impreso tiene ese alto y las filas vacias son para
 * anotar a mano. Una planilla con mas de diez viajes se parte en varias
 * hojas.
 */
@Injectable({ providedIn: 'root' })
export class PlanillaMovilidadPdfService {

  /** Cuantos viajes entran en una hoja del formato. */
  private static readonly VIAJES_POR_HOJA = 10;

  /** Una planilla: la guarda y la abre en otra pestana. */
  generar(datos: DatosPlanillaPdf): void {
    const doc = new jsPDF('l', 'mm', 'a4');
    this.dibujarPlanilla(doc, datos, true);

    const nro = (datos.planilla?.codPlanilla || '').toString().padStart(4, '0');
    this.entregar(doc, `Planilla_Movilidad_${nro}_${new Date().getTime()}.pdf`);
  }

  /**
   * Varias planillas en un solo PDF, una hoja por planilla.
   *
   * <p>Es lo que se manda a revisar: un archivo por planilla obliga a abrir
   * cincuenta adjuntos para firmar cincuenta papeles.
   */
  generarVarias(lista: DatosPlanillaPdf[], nombreArchivo?: string): void {
    if (!lista || !lista.length) {
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4');

    lista.forEach((datos, i) => {
      this.dibujarPlanilla(doc, datos, i === 0);
    });

    this.entregar(doc,
      nombreArchivo || `Planillas_Movilidad_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /**
   * Dibuja una planilla, partiendola en hojas de diez viajes.
   *
   * @param primera si es la primera hoja del documento; si no, abre una nueva.
   */
  private dibujarPlanilla(doc: jsPDF, datos: DatosPlanillaPdf, primera: boolean): void {
    const todos = datos.viajes || [];
    const porHoja = PlanillaMovilidadPdfService.VIAJES_POR_HOJA;
    const hojas = Math.max(1, Math.ceil(todos.length / porHoja));

    // El TOTAL impreso es el de la planilla entera, no el de la hoja: una
    // planilla de doce viajes se firma por su total, no por dos subtotales.
    const total = todos.reduce((a, v) => a + (v.importe ?? 0), 0);

    for (let h = 0; h < hojas; h++) {
      if (!(primera && h === 0)) {
        doc.addPage('a4', 'l');
      }
      this.dibujarHoja(doc, {
        ...datos,
        viajes: todos.slice(h * porHoja, (h + 1) * porHoja),
      }, total);
    }
  }

  /** Guarda el archivo y, si el navegador deja, lo abre para revisarlo. */
  private entregar(doc: jsPDF, filename: string): void {
    doc.save(filename);
    try {
      const blob = doc.output('blob') as Blob;
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) { console.warn('No se pudo abrir vista previa', e); }
  }

  /** Una hoja del formato, con los viajes que le tocan. */
  private dibujarHoja(doc: jsPDF, datos: DatosPlanillaPdf, totalPlanilla?: number): void {
    const planilla = datos.planilla;
    const viajes = datos.viajes || [];
    const titular = (datos.nombreTrabajador || '').trim();
    const maxDia = datos.importeMaxDia ?? 45.20;
    const ubigeo = datos.ubigeo ?? ((c?: string | null) => c || '');

    const pageW = 297;
    const marginX = 8, marginY = 8;
    const usableW = pageW - marginX * 2;

    /* HEADER */
    const headerH = 22;
    const colLogoW = 36, colCtrlW = 70;
    const colTitleW = usableW - colLogoW - colCtrlW;

    doc.setDrawColor(0); doc.setLineWidth(0.35);
    doc.rect(marginX, marginY, usableW, headerH);
    doc.line(marginX + colLogoW, marginY, marginX + colLogoW, marginY + headerH);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(50, 70, 130);
    doc.text('AQUARIUS', marginX + colLogoW / 2, marginY + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(120, 120, 120);
    doc.text('Consulting', marginX + colLogoW / 2, marginY + 16, { align: 'center' });

    const titleX = marginX + colLogoW;
    doc.line(titleX + colTitleW, marginY, titleX + colTitleW, marginY + headerH);
    doc.line(titleX, marginY + 13, titleX + colTitleW, marginY + 13);

    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('PLANILLA DE MOVILIDAD - INDIVIDUAL', titleX + colTitleW / 2, marginY + 9, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Referencia: Formato', titleX + colTitleW / 2, marginY + 18, { align: 'center' });

    const ctrlX = titleX + colTitleW;
    const ctrlRows = [
      ['Código:', 'FIN-PR-04-FO-03'],
      ['Ver.:', '02', 'Elab.:', 'SGA'],
      ['Rev.:', 'CSIG', 'Aprob.:', 'GAC'],
      ['Fecha:', '27/10/2022', 'Pág.:', '1 de 1']
    ];
    const ctrlRowH = headerH / ctrlRows.length;
    doc.setFontSize(7);
    ctrlRows.forEach((row, i) => {
      const y = marginY + ctrlRowH * i;
      if (i > 0) doc.line(ctrlX, y, ctrlX + colCtrlW, y);
      if (row.length === 2) {
        doc.setFont('helvetica', 'bold'); doc.text(row[0], ctrlX + 2, y + ctrlRowH * 0.65);
        doc.setFont('helvetica', 'normal'); doc.text(row[1], ctrlX + 20, y + ctrlRowH * 0.65);
      } else {
        const halfW = colCtrlW / 2;
        doc.line(ctrlX + halfW, y, ctrlX + halfW, y + ctrlRowH);
        doc.setFont('helvetica', 'bold'); doc.text(row[0], ctrlX + 2, y + ctrlRowH * 0.65);
        doc.setFont('helvetica', 'normal'); doc.text(row[1], ctrlX + 15, y + ctrlRowH * 0.65);
        doc.setFont('helvetica', 'bold'); doc.text(row[2], ctrlX + halfW + 2, y + ctrlRowH * 0.65);
        doc.setFont('helvetica', 'normal'); doc.text(row[3], ctrlX + halfW + 18, y + ctrlRowH * 0.65);
      }
    });

    /* DATOS TRABAJADOR */
    let y = marginY + headerH + 6;
    const fechaEmisionStr = this.fechaCorta(planilla.fechaPlanilla);
    const nroPlanilla = (planilla.codPlanilla || '').toString().padStart(4, '0');
        const nombreTrabajador = titular || '____________________________________________';

    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('FECHA DE EMISION / PERIODO DE AFECTACIÓN', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaEmisionStr, marginX + 80, y);
    doc.line(marginX + 78, y + 1, marginX + 160, y + 1);

    doc.setFont('helvetica', 'bold');
    doc.text('N° DE PLANILLA:', pageW - marginX - 50, y);
    doc.setFont('helvetica', 'normal');
    doc.text(nroPlanilla, pageW - marginX - 18, y);
    doc.line(pageW - marginX - 20, y + 1, pageW - marginX, y + 1);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('NOMBRE Y APELLIDOS:', marginX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(nombreTrabajador, marginX + 38, y);
    doc.line(marginX + 36, y + 1, pageW - marginX, y + 1);

    /* TABLA DE VIAJES */
    y += 5;
    const tableTop = y;
    const colFW = 22, colMotW = 70, colOrW = 78, colDsW = 78;
    const colMonW = usableW - colFW - colMotW - colOrW - colDsW;
    const headerRowH = 8, dataRowH = 12;
    const totalDataRows = PlanillaMovilidadPdfService.VIAJES_POR_HOJA;

    doc.setFillColor(245, 245, 245);
    doc.rect(marginX, tableTop, usableW, headerRowH, 'F');
    doc.setDrawColor(0); doc.rect(marginX, tableTop, usableW, headerRowH);

    let cx = marginX;
    const headers = ['FECHA', 'MOTIVO', 'ORIGEN (PROYECTO / DISTRITO)', 'DESTINO (PROYECTO / DISTRITO)', 'MONTO'];
    const widths = [colFW, colMotW, colOrW, colDsW, colMonW];

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    headers.forEach((h, i) => {
      doc.text(h, cx + widths[i] / 2, tableTop + 5.2, { align: 'center' });
      if (i > 0) doc.line(cx, tableTop, cx, tableTop + headerRowH);
      cx += widths[i];
    });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    let yRow = tableTop + headerRowH;

    for (let i = 0; i < totalDataRows; i++) {
      const viaje = viajes[i];
      doc.rect(marginX, yRow, usableW, dataRowH);
      cx = marginX;
      for (let j = 0; j < widths.length - 1; j++) {
        cx += widths[j];
        doc.line(cx, yRow, cx, yRow + dataRowH);
      }

      if (viaje) {
        const fecha = this.fechaCorta(viaje.fecItemPlanilla);
        const motivo = viaje.glosa || '';
        const dirOri = (viaje.dirOrigen || '').trim();
        const dirDst = (viaje.dirDestino || '').trim();
        const ubiOri = ubigeo(viaje.codOrigen);
        const ubiDst = ubigeo(viaje.codDestino);
        const origenLinea1 = dirOri || '—';
        const origenLinea2 = ubiOri || (viaje.codOrigen || '');
        const destinoLinea1 = dirDst || '—';
        const destinoLinea2 = ubiDst || (viaje.codDestino || '');
        const monto = (viaje.importe ?? 0).toFixed(2);

        let cx2 = marginX;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
        doc.text(fecha, cx2 + 2, yRow + 5);
        cx2 += widths[0];

        const motivoLines = doc.splitTextToSize(motivo, widths[1] - 4);
        doc.text(motivoLines.slice(0, 2), cx2 + 2, yRow + 4);
        cx2 += widths[1];

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
        doc.text(doc.splitTextToSize(origenLinea1, widths[2] - 4).slice(0, 1), cx2 + 2, yRow + 4);
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(90, 90, 90);
        doc.text(doc.splitTextToSize(origenLinea2, widths[2] - 4).slice(0, 1), cx2 + 2, yRow + 9);
        cx2 += widths[2];

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
        doc.text(doc.splitTextToSize(destinoLinea1, widths[3] - 4).slice(0, 1), cx2 + 2, yRow + 4);
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(90, 90, 90);
        doc.text(doc.splitTextToSize(destinoLinea2, widths[3] - 4).slice(0, 1), cx2 + 2, yRow + 9);
        cx2 += widths[3];

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
        doc.text(monto, cx2 + widths[4] - 2, yRow + 5, { align: 'right' });
      }
      yRow += dataRowH;
    }

    /* TOTAL */
    const totalRowH = 8;
    doc.setFillColor(245, 245, 245);
    doc.rect(marginX, yRow, usableW, totalRowH, 'F');
    doc.rect(marginX, yRow, usableW, totalRowH);
    cx = marginX + widths[0] + widths[1] + widths[2];
    doc.line(cx, yRow, cx, yRow + totalRowH);
    cx += widths[3];
    doc.line(cx, yRow, cx, yRow + totalRowH);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.text('TOTAL', cx - 4, yRow + 5.5, { align: 'right' });
    const totalImporte = totalPlanilla
                      ?? viajes.reduce((a, v) => a + (v.importe ?? 0), 0);
    doc.text(totalImporte.toFixed(2), cx + widths[4] - 2, yRow + 5.5, { align: 'right' });

    /* FOOTER */
    const footerY = yRow + totalRowH + 8;
    doc.setLineWidth(0.4); doc.setDrawColor(0);
    doc.line(marginX + 8, footerY + 6, marginX + 70, footerY + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('FIRMA DEL TRABAJADOR', marginX + 39, footerY + 10, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.text('DNI:', marginX + 8, footerY + 18);
    doc.setFont('helvetica', 'normal'); doc.text('_______________________', marginX + 18, footerY + 18);

    const notesX = marginX + 92;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const impMaxStr = `S/ ${maxDia.toFixed(2)}`;
    doc.text(`* Monto total maximo por dia ${impMaxStr}.`, notesX, footerY + 6);

    const nota2 = doc.splitTextToSize(
      '. No se consideran traslados desde su domicilio al punto de trabajo a excepción de traslados de equipos de ser así deberán ser facturados y previamente autorizados.',
      usableW - 100
    );
    doc.text(nota2, notesX, footerY + 12);
  }

  /** dd/mm/aa, o los guiones del formato cuando no hay fecha. */
  private fechaCorta(d: Date | string | undefined | null): string {
    if (!d) return '__/__/__';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '__/__/__';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = String(dt.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }
}
