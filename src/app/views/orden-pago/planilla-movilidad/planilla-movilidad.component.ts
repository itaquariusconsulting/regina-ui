import { Component, OnInit } from '@angular/core';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs/internal/Observable';
import { LoadingService } from '../../../services/loading.service';
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
import { PublicacionPlanillaService } from '../../../services/publicacion-planilla.service';
import { PlanillaMovilidadPdfService } from '../../../services/planilla-movilidad-pdf.service';
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
    private regRenValidateService: RegRenValidateService,
    private publicacionService: PublicacionPlanillaService,
    private pdfService: PlanillaMovilidadPdfService
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
    this.consultarEstadoEnvio();
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

  /**
   * El formato oficial ya no se dibuja aca.
   *
   * <p>Vive en PlanillaMovilidadPdfService porque contabilidad imprime el
   * mismo papel desde la pantalla de verificacion. Es el documento que se
   * firma: no puede haber dos versiones.
   */
  private construirPDFOficial(planilla: OrdenPagoCabPlanilla,
                              viajes: OrdenPagoPlanillaMovilidadDet[]): void {
    this.pdfService.generar({
      planilla,
      viajes,
      nombreTrabajador: this.getTitularNombre(),
      importeMaxDia: this.importeMaxDia,
      ubigeo: (cod) => this.mapUbigeoText(cod),
    });
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
      this.planillaService.deletePlanillaMovilidad(planilla).subscribe({
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

  /** Si el servidor tiene habilitado el envio a contabilidad. */
  envioHabilitado = false;
  private consultarEstadoEnvio(): void {
    this.publicacionService.estado().subscribe({
      next: (r: any) => {
        this.envioHabilitado = !!r?.resultado?.activa;
      },
      // Si no se puede saber, se asume apagado: no ofrecer algo que escribe
      // asientos es siempre el error barato.
      error: () => { this.envioHabilitado = false; }
    });
  }

  /**
   * Si la planilla ya no se puede tocar.
   *
   * <p>Son dos estados y no uno: CE es cerrada, AP es cerrada Y publicada en
   * contabilidad. Las comprobaciones miraban solo CE, asi que al aparecer AP
   * una planilla con asientos ya emitidos volvia a quedar editable y
   * borrable. Borrarla dejaria esos asientos huerfanos en el ERP, donde
   * REGINA no puede ir a limpiarlos.
   */
  estaCerrada(planilla: OrdenPagoCabPlanilla): boolean {
    const s = planilla?.statusPlanilla;
    return s === 'CE' || s === 'AP';
  }

  onClosePlanillaMovilidad(planilla: OrdenPagoCabPlanilla): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: { title: 'Cerrar Planilla',
              // El texto cambia segun el servidor tenga el envio encendido o
              // no: prometer que va a contabilidad cuando esta apagado seria
              // peor que no decirlo.
              message: this.envioHabilitado
                ? `¿Cerrar la planilla ${planilla.codPlanilla}? Queda lista para que `
                  + `contabilidad la revise y emita el asiento. No podrá editarse, y `
                  + `esta acción no se puede deshacer desde REGINA.`
                : `¿Estás seguro de cerrar la planilla ${planilla.codPlanilla}? Una vez cerrada no podrá editarse.`,
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
            next: () => {
              // Cerrar ya no publica. Contabilidad pidio revisar antes de que
              // salga el asiento, asi que la planilla queda en CE —cerrada y
              // esperando— y el asiento lo emite quien aprueba, desde OP
              // Rendidas. La planilla en si sigue grabandose en la base de
              // contabilidad como siempre: lo que espera es el asiento.
              this.getPlanillaMovilidad();
            },
            error: () => { planilla.statusPlanilla = 'PE'; }
          });
        },
        error: () => { this.loadingService.hide(); }
      });
    });
  }
}
