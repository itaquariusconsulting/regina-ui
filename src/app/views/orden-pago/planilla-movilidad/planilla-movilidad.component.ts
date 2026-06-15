import { Component, OnInit } from '@angular/core';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs/internal/Observable';
import { LoadingService } from '../../../services/loading.service';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';
import { OrdenPago } from '../../../models/orden-pago';
import { Response } from '../../../models/response';
import { DeviceService } from '../../../services/core-service/device.service';
import { OrdenPagoDetService } from '../../../services/orden-pago-det.service';
import { OrdenPagoPlanillaMovilidadCabService } from '../../../services/orden-pago-planilla-movilidad-cab.service';
import { OrdenPagoPlanillaMovilidadDetService } from '../../../services/orden-pago-planilla-movilidad-det.service';
import { WrapperRequestPlanillaMovilidadCab } from '../../../models/wrappers/wrapper-request-planilla-movilidad-cab';
import { Router } from '@angular/router';
import { MaeDocumento } from '../../../models/mae-documento';
import { OrdenPagoCabPlanilla, ViewMode } from '../../../models/orden-pago-planilla-movilidad-cab';
import { OrdenPagoPlanillaMovilidadDet } from '../../../models/orden-pago-planilla-movilidad-det';
import { MaeUbigeo } from '../../../models/mae-ubigeo';
import { MaestrosService } from '../../../services/maestros.service';
import { MaeAuxiliarDTO } from '../../../models/mae-auxiliar-dto';
import { ConfigService } from '../../../services/config.service';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { RegRenValidate } from '../../../models/reg-ren-validate';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { HttpStatusCode } from '@angular/common/http';

/** field_code de la regla en REG_REN_VALIDATE para el importe máximo por día */
const RULE_MOVILIDAD_MAX_DIA = 'MOVILIDAD_MAX_DIA';

@Component({
  selector: 'app-planilla-movilidad',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './planilla-movilidad.component.html',
  styleUrl: './planilla-movilidad.component.scss'
})
export class PlanillaMovilidadComponent implements OnInit {

  constructor(
    private location: Location,
    private loadingService: LoadingService,
    private planillaService: OrdenPagoPlanillaMovilidadCabService,
    private planillaDetService: OrdenPagoPlanillaMovilidadDetService,
    private ordenPagoDetService: OrdenPagoDetService,
    private deviceService: DeviceService,
    private router: Router,
    private dialog: MatDialog,
    private maestrosService: MaestrosService,
    private configService: ConfigService,
    private regRenValidateService: RegRenValidateService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  /** Mensaje de error definido en la regla de la tabla REG_REN_VALIDATE */
  importeMaxDiaErrorMsg: string = '';

  ubigeos: MaeUbigeo[] = [];
  auxiliares: MaeAuxiliarDTO[] = [];
  importeMaxDia: number = 45.20;

  codEmpresa: string = sessionStorage.getItem("codempresa") ?? '';
  isLoading$: Observable<boolean>;
  codAuxiliar: string = '';

  orden: OrdenPago = new OrdenPago();
  planillas: OrdenPagoCabPlanilla[] = [];
  planilla: OrdenPagoCabPlanilla = new OrdenPagoCabPlanilla();
  pageSize = 6;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;
  isDesktop: boolean = false;
  documentosGeneral: MaeDocumento[] = [];

  public ViewMode = ViewMode;

  static createDefault(orden: any): OrdenPagoCabPlanilla {
    const item = new OrdenPagoCabPlanilla();
    item.codEmpresa = orden.codEmpresa;
    item.codSucursal = orden.codSucursal;
    item.anioPeriodo = orden.anoPeriodo;
    item.codPeriodo = orden.codPeriodo;
    item.numOrden = orden.numOrden;
    item.cCentroCostos = orden.codCCostos;
    item.total = 0; item.recibido = 0; item.devolucion = 0; item.maxNumViajes = 0;
    item.glosa = ''; item.statusPlanilla = 'PE';
    item.fechaPlanilla = new Date();
    item.codAuxiliarBanco = ''; item.codAuxiliarPersonal = '';
    item.codPlanilla = ''; item.monto = 0;
    return item;
  }

  async ngOnInit(): Promise<void> {
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data.orden;
    }
    this.isDesktop = this.deviceService.isDesktopDevice();
    const user = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')!) : null;
    this.codEmpresa = user?.codEmpresa || '';
    this.codAuxiliar = user?.codAuxiliar || '';

    // Cargar regla del importe máximo por día desde REG_REN_VALIDATE (preferido)
    // Si falla, intentar config.ini como fallback. Si todo falla, queda el default 45.20.
    await this.cargarImporteMaxDia();

    this.cargarUbigeos();
    this.cargarAuxiliares();
    this.getPlanillaMovilidad();
  }

  /**
   * Carga el importe máximo por día y su mensaje de error.
   * Prioridad:
   *   1) REG_REN_VALIDATE.field_code = 'MOVILIDAD_MAX_DIA' (max_value + error_message)
   *   2) config.ini -> PLANILLA_MOVILIDAD_IMPORTE_MAX_DIA
   *   3) Default 45.20
   */
  private async cargarImporteMaxDia(): Promise<void> {
    try {
      const res = await new Promise<Response>((resolve, reject) =>
        this.regRenValidateService.getRegRenValidateRules().subscribe({
          next: r => resolve(r),
          error: e => reject(e)
        })
      );

      const reglas: RegRenValidate[] = res?.resultado || [];
      const regla = reglas.find(r =>
        (r.fieldCode || '').toUpperCase() === RULE_MOVILIDAD_MAX_DIA && r.isActive !== false
      );

      if (regla && typeof regla.maxValue === 'number' && regla.maxValue > 0) {
        this.importeMaxDia = regla.maxValue;
        this.importeMaxDiaErrorMsg = regla.errorMessage || '';
        return;
      }
    } catch { /* ignorar, intentamos fallback */ }

    // Fallback: config.ini
    try {
      await this.configService.loadConfig();
      const v = this.configService.get('PLANILLA_MOVILIDAD_IMPORTE_MAX_DIA');
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) this.importeMaxDia = n;
    } catch { /* default 45.20 */ }
  }

  private cargarUbigeos(): void {
    this.maestrosService.getUbigeos().subscribe({
      next: (res: Response) => { this.ubigeos = res?.resultado || []; },
      error: () => { this.ubigeos = []; }
    });
  }

  private cargarAuxiliares(): void {
    this.maestrosService.getListaAuxiliaresPE(this.codEmpresa).subscribe({
      next: (res: Response) => { this.auxiliares = res?.resultado || []; },
      error: () => { this.auxiliares = []; }
    });
  }

  private getTitularNombre(): string {
    const cod = this.orden?.codAuxiliar;
    if (!cod) return '';
    if (this.orden?.cdesAuxiliar) return this.orden.cdesAuxiliar;
    const a = this.auxiliares.find(x => x.codAuxiliar === cod);
    return a?.desAuxiliar || cod;
  }

  private mapUbigeoText(cod?: string | null): string {
    if (!cod) return '';
    const u = this.ubigeos.find(x => x.codUbigeo === cod);
    if (!u) return cod;
    return [u.desDepartamento, u.desProvincia, u.desDistrito].filter(Boolean).join(' - ');
  }

  devolverDocumento(tipoDoc: string): string {
    return this.documentosGeneral.find(doc => doc.codDocumento == tipoDoc)?.desDocumento ?? '';
  }

  getPlanillaMovilidad() {
    this.loadingService.show();
    const wrapper = new WrapperRequestPlanillaMovilidadCab();
    wrapper.anioPeriodo = this.orden.anoPeriodo;
    wrapper.codPeriodo = this.orden.codPeriodo;
    wrapper.codEmpresa = this.orden.codEmpresa;
    wrapper.codSucursal = this.orden.codSucursal;
    wrapper.numOrden = this.orden.numOrden;
    this.planillaService.getPlanillaMovilidad(wrapper).subscribe(
      (response: Response) => { this.planillas = response.resultado; this.loadingService.hide(); },
      () => { this.loadingService.hide(); }
    );
  }

  onBack(): void { this.location.back(); }

  changePage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
  }

  /* ============ PDF FORMATO OFICIAL ============ */
  generarPanillaMovilidadPDF(planilla?: OrdenPagoCabPlanilla): void {
    const pl = planilla || this.planilla;
    if (!pl || !pl.codPlanilla) {
      Swal.fire({ title: 'Aviso', text: 'No hay planilla seleccionada para imprimir.', icon: 'warning' });
      return;
    }
    this.loadingService.show();
    this.planillaDetService.listarDetalle(
      pl.codEmpresa || this.orden.codEmpresa || '',
      pl.codSucursal || this.orden.codSucursal || '',
      pl.anioPeriodo || this.orden.anoPeriodo || '',
      pl.codPeriodo || this.orden.codPeriodo || '',
      pl.numOrden || this.orden.numOrden || '',
      pl.codPlanilla
    ).subscribe({
      next: (res: Response) => {
        const detalle: OrdenPagoPlanillaMovilidadDet[] = res?.resultado || [];
        this.construirPDFOficial(pl, detalle);
        this.loadingService.hide();
      },
      error: () => { this.construirPDFOficial(pl, []); this.loadingService.hide(); }
    });
  }

  private construirPDFOficial(planilla: OrdenPagoCabPlanilla, viajes: OrdenPagoPlanillaMovilidadDet[]): void {
    const doc = new jsPDF('l', 'mm', 'a4');
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
    const fechaEmisionStr = this.formatDateShort(planilla.fechaPlanilla);
    const nroPlanilla = (planilla.codPlanilla || '').toString().padStart(4, '0');
    const titular = this.getTitularNombre();
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
    const headerRowH = 8, dataRowH = 12, totalDataRows = 10;

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
        const fecha = this.formatDateShort(viaje.fecItemPlanilla);
        const motivo = viaje.glosa || '';
        const dirOri = (viaje.dirOrigen || '').trim();
        const dirDst = (viaje.dirDestino || '').trim();
        const ubiOri = this.mapUbigeoText(viaje.codOrigen);
        const ubiDst = this.mapUbigeoText(viaje.codDestino);
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
    const totalImporte = viajes.reduce((a, d) => a + (d.importe ?? 0), 0);
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
    const impMaxStr = `S/ ${this.importeMaxDia.toFixed(2)}`;
    doc.text(`* Monto total maximo por dia ${impMaxStr}.`, notesX, footerY + 6);

    const nota2 = doc.splitTextToSize(
      '. No se consideran traslados desde su domicilio al punto de trabajo a excepción de traslados de equipos de ser así deberán ser facturados y previamente autorizados.',
      usableW - 100
    );
    doc.text(nota2, notesX, footerY + 12);

    const filename = `Planilla_Movilidad_${nroPlanilla}_${new Date().getTime()}.pdf`;
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

  private formatDateShort(d: Date | string | undefined | null): string {
    if (!d) return '__/__/__';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '__/__/__';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = String(dt.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  /* ============ NAVEGACIÓN ============ */
  onViewPlanillaMovilidad(planilla: OrdenPagoCabPlanilla): void {
    this.router.navigate(['/edit-planilla-movilidad'], {
      state: { data: { orden: this.orden, planilla, viewOnly: true, importeMaxDia: this.importeMaxDia, importeMaxDiaErrorMsg: this.importeMaxDiaErrorMsg } }
    });
  }

  onEditPlanillaMovilidad(planilla: OrdenPagoCabPlanilla, mode: ViewMode): void {
    const dataToPass = (mode === ViewMode.New)
      ? PlanillaMovilidadComponent.createDefault(this.orden)
      : planilla;
    this.router.navigate(['/edit-planilla-movilidad'], {
      state: { data: { orden: this.orden, planilla: dataToPass, importeMaxDia: this.importeMaxDia, importeMaxDiaErrorMsg: this.importeMaxDiaErrorMsg } }
    });
  }

  onDeletePlanillaMovilidad(planilla: OrdenPagoCabPlanilla): void {
    if (!planilla.codPlanilla) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: { title: 'Confirmar Eliminación',
              message: `¿Estás seguro de que deseas eliminar la planilla ${planilla.codPlanilla}?`,
              type: 'confirm' }
    }).afterClosed().subscribe(confirm => {
      if (!confirm) return;
      this.loadingService.show();
      this.planillaService.deletePlanillaMovilidad(planilla.codPlanilla!).subscribe({
        next: () => {
          this.planillas = this.planillas.filter(p => p.codPlanilla !== planilla.codPlanilla);
          this.loadingService.hide();
        },
        error: (err) => {
          this.loadingService.hide();
          const isFk = err?.status === HttpStatusCode.Conflict;
          this.dialog.open(ConfirmDialogComponent, {
            width: '300px',
            data: { title: isFk ? 'No permitido' : 'Error', type: 'alert',
                    message: err?.error?.mensaje || 'No se pudo eliminar la planilla.' }
          });
        }
      });
    });
  }

  onClosePlanillaMovilidad(planilla: OrdenPagoCabPlanilla): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: { title: 'Cerrar Planilla',
              message: `¿Estás seguro de cerrar la planilla ${planilla.codPlanilla}? Una vez cerrada no podrá editarse.`,
              type: 'confirm' }
    }).afterClosed().subscribe(confirm => {
      if (!confirm) return;
      this.loadingService.show();
      this.planillaDetService.listarDetalle(
        planilla.codEmpresa || '', planilla.codSucursal || '',
        planilla.anioPeriodo || '', planilla.codPeriodo || '',
        planilla.numOrden || '', planilla.codPlanilla || ''
      ).subscribe({
        next: (r: Response) => {
          this.loadingService.hide();
          const detalles = r?.resultado || [];
          if (detalles.length === 0) {
            this.dialog.open(ConfirmDialogComponent, {
              width: '300px',
              data: { title: 'Sin viajes', type: 'alert',
                      message: 'La planilla no tiene viajes registrados; no se puede cerrar.' }
            });
            return;
          }
          planilla.statusPlanilla = 'CE';
          this.planillaService.updatePlanillaMovilidad(planilla).subscribe({
            next: () => this.getPlanillaMovilidad(),
            error: () => { planilla.statusPlanilla = 'PE'; }
          });
        },
        error: () => { this.loadingService.hide(); }
      });
    });
  }
}
