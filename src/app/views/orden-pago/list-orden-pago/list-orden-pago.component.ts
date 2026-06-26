import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  TemplateRef
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter, forkJoin, Observable, Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import jsPDF from 'jspdf';
import { OrdenPago } from '../../../models/orden-pago';
import { OrdenPagoService } from '../../../services/orden-pago.service';
import { WrapperRequestOrdenPago } from '../../../models/wrappers/wrapper-request-orden-pago';
import { Response } from '../../../models/response';
import { OcrService } from '../../../services/ocr.service';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { MessageRenderAccount } from '../../../shared/constants/messages';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { WrapperRequestVoucherItem } from '../../../models/wrappers/wrapper-request-voucher-item';
import { ConVoucherService } from '../../../services/con-voucher-item.service';
import { ConVoucherItem } from '../../../models/con-voucher.item';
import * as bootstrap from 'bootstrap';
import { ConfigService } from '../../../services/config.service';
import { OrdenPagoDetService } from '../../../services/orden-pago-det.service';
import { WrapperRequestOrdenPagoDet } from '../../../models/wrappers/wrapper-request-orden-pago-det';
import { OrdenPagoDetDTO } from '../../../models/orden-pago-det';
import { OrdenPagoPlanillaMovilidadCabService } from '../../../services/orden-pago-planilla-movilidad-cab.service';
import { OrdenPagoPlanillaMovilidadDetService } from '../../../services/orden-pago-planilla-movilidad-det.service';
import { ChatFiltrosService } from '../../../services/chat-filtros.service';
import { OrdenPagoCabPlanilla } from '../../../models/orden-pago-planilla-movilidad-cab';
import { OrdenPagoPlanillaMovilidadDet } from '../../../models/orden-pago-planilla-movilidad-det';
import { WrapperRequestPlanillaMovilidadCab } from '../../../models/wrappers/wrapper-request-planilla-movilidad-cab';

export class Imagen {
  documentType?: string;
  documentNumber?: string;
  issuerRuc?: string;
  issuerName?: string;
  issuerAddress?: string;
  documentDate?: string;
}

@Component({
  selector: 'app-list-orden-pago',
  templateUrl: './list-orden-pago.component.html',
  styleUrls: ['./list-orden-pago.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LoadingDancingSquaresComponent,
    HasPermissionDirective
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ListOrdenPagoComponent implements OnInit, OnDestroy {

  @ViewChild('myTable') tableRef!: ElementRef;
  @ViewChild('orderDialog') orderDialog!: TemplateRef<any>;
  dialogRef!: MatDialogRef<any>;

  constructor(
    private ordenPagoService: OrdenPagoService,
    private location: Location,
    private router: Router,
    private dialog: MatDialog,
    private ocrService: OcrService,
    private loadingService: LoadingService,
    private conVoucherService: ConVoucherService,
    private ordenPagoDetService: OrdenPagoDetService,
    private planillaCabService: OrdenPagoPlanillaMovilidadCabService,
    private planillaDetService: OrdenPagoPlanillaMovilidadDetService,
    private chatFiltrosService: ChatFiltrosService,
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  /** Suscripción al BehaviorSubject de filtros del chat IA. */
  private chatFiltrosSub?: Subscription;

  wrapperRequestOrdenPago: WrapperRequestOrdenPago = new WrapperRequestOrdenPago();
  isAdminUser: boolean = false;
  isLoading$: Observable<boolean>;

  detailsAsiento: ConVoucherItem[] = [];
  ordenes: OrdenPago[] = [];
  ordenesGeneral: OrdenPago[] = [];
  pagedOrdenes: OrdenPago[] = [];

  filtrarOrden: string = '';

  pageSize = 6;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;

  detail: OrdenPago = new OrdenPago();
  modal: any;

  private navigationSub!: Subscription;
  imagen: Imagen = new Imagen();

  private readonly stateActions: any = {
    'EM': { asiento_contable: false, rendir_cuenta: false, detalle: false, planilla_movillidad: false },
    'PE': { asiento_contable: false, rendir_cuenta: true, detalle: true, planilla_movillidad: true },
    'LQ': { asiento_contable: true, rendir_cuenta: false, detalle: true, planilla_movillidad: false },
    'PR': { asiento_contable: false, rendir_cuenta: false, detalle: false, planilla_movillidad: false }
  };

  ngOnInit(): void {

    this.inicializarWrapperDesdeSession();
    this.cargarDesdeStateOApi();

    this.navigationSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.cargarDesdeStateOApi();
      });

    // 🆕 Escuchar filtros del chat IA.
    //
    // Por qué un servicio en lugar de history.state:
    //   Cuando el usuario YA está en /list-orders y pide otra búsqueda
    //   por chat, Angular NO emite NavigationEnd porque la URL no cambia,
    //   por lo que ngOnInit ni cargarDesdeStateOApi se vuelven a ejecutar.
    //   El servicio (BehaviorSubject) garantiza que el filtro llegue
    //   sin importar el estado de navegación.
    this.chatFiltrosSub = this.chatFiltrosService.filtrosOrdenes$
      .subscribe(filtros => {
        if (!filtros) return;
        console.log('🎯 [list-orden-pago] filtros recibidos por servicio:', filtros);
        // Si la lista general ya está cargada, aplicamos directo.
        // Si todavía no, los filtros quedan en el servicio y se
        // aplicarán cuando termine getOrdenesPago().
        if (this.ordenesGeneral && this.ordenesGeneral.length > 0) {
          this.aplicarFiltrosIA(filtros);
        } else {
          // Forzamos una recarga del listado pasándole los filtros.
          this.getOrdenesPagoConFiltros(filtros);
        }
      });
  }

  ngOnDestroy(): void {
    this.navigationSub?.unsubscribe();
    this.chatFiltrosSub?.unsubscribe();
  }

  private inicializarWrapperDesdeSession(): void {

    const userString = sessionStorage.getItem('user');

    if (!userString) {
      return;
    }

    try {

      const user = JSON.parse(userString);
      this.isAdminUser = user.userAdmin || false;
      this.wrapperRequestOrdenPago.codAuxiliar = user.codAuxiliar || '';
      this.wrapperRequestOrdenPago.codEmpresa = user.codEmpresa || '';
      this.wrapperRequestOrdenPago.codSucursal = user.codSucursal || '';
      this.wrapperRequestOrdenPago.isAdmin = this.isAdminUser || false;

    } catch (e) {
      console.error('Error al parsear User desde sessionStorage', e);
    }
  }

  private cargarDesdeStateOApi(): void {

    const state = history.state;

    this.loadingService.show();

    if (state && state.data && state.data.resultado) {

      this.ordenes = state.data.resultado;
      this.ordenesGeneral = state.data.resultado;

      this.currentPage = 0;
      this.buildPagination();
      this.loadingService.hide();

      // Si vinieron filtros del chat IA junto con la lista preconstruida,
      // los aplicamos también sobre la lista ya cargada.
      this.aplicarFiltrosIA(state.filtros);

    } else {

      // Sin lista pre-cargada: traemos del backend y, cuando termine,
      // aplicamos los filtros si venían en el state.
      const filtrosIA = state?.filtros;
      this.getOrdenesPagoConFiltros(filtrosIA);

    }
  }

  /**
   * Versión de getOrdenesPago que aplica los filtros del chat IA una vez
   * cargada la lista del backend. Reutiliza el subscribe original.
   */
  private getOrdenesPagoConFiltros(filtrosIA: any): void {
    this.ordenPagoService
      .getOrdenesPago(this.wrapperRequestOrdenPago)
      .subscribe({
        next: (response: Response) => {
          this.ordenes = response.resultado || [];
          if (this.isAdminUser == false) {
            this.ordenes = this.ordenes.filter(filtro => filtro.tipEstado == "PR" || filtro.tipEstado == "LQ");
          }
          this.ordenesGeneral = this.ordenes;
          this.currentPage = 0;
          this.buildPagination();
          this.loadingService.hide();

          // Aplicar filtros del chat IA si los hay.
          this.aplicarFiltrosIA(filtrosIA);
        },
        error: () => {
          this.loadingService.hide();
        }
      });
  }

  /**
   * Aplica los filtros que vienen del chat de Regina IA sobre la lista
   * de órdenes ya cargada (`ordenesGeneral`). Los filtros son AND.
   *
   * Filtros soportados:
   *   - numOrden       → match tolerante a ceros a la izquierda
   *                      ('16179' o '000016179' matchean la misma orden)
   *   - nombreCompleto → busca en cdesAuxiliar (descripción del proveedor)
   *                      sin acentos, case-insensitive y con FONÉTICA
   *                      (Isla = Ysla = Hisla = Hysla, Vásquez = Basquez…)
   *   - nombre/apellido → si vienen separados, se concatenan y se aplica
   *                      el mismo matching
   *   - anio           → compara con orden.anoPeriodo
   *   - mes            → compara con orden.codPeriodo (zero-padded a 2)
   *   - centroCosto    → busca en orden.codCCostos (match parcial)
   */
  private aplicarFiltrosIA(filtros: any): void {
    if (!filtros || typeof filtros !== 'object') {
      console.log('🎯 [list-orden-pago] filtros del chat IA: nada que aplicar (vacío o null)');
      return;
    }
    console.log('🎯 [list-orden-pago] aplicando filtros del chat IA:', filtros);
    console.log(`🎯 [list-orden-pago] tamaño ordenesGeneral: ${this.ordenesGeneral?.length || 0}`);

    const norm = (s: any): string => {
      if (s === null || s === undefined) return '';
      return String(s)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')   // quitar acentos (rango unicode combining)
        .toLowerCase()
        .trim();
    };

    /**
     * Reduce una palabra a su "huella fonética" en español-peruano para
     * que apellidos que suenan igual matcheen aunque se escriban distinto.
     *
     * Equivalencias aplicadas (en orden):
     *   - quitar H al inicio:     "Hisla" → "isla"
     *   - quitar H entre vocales: "Cohel" → "Coel"
     *   - Y → I:                  "Ysla" → "Isla", "Reyes" → "Reies"
     *   - V → B:                  "Vásquez" → "Básquez"
     *   - Z → S:                  "Vásquez" → "Básqueš" → "basques"
     *   - QU → K:                 "Quispe" → "Kispe"
     *   - C antes de E/I → S:     "Cecilia" → "Sesilia"
     *   - C otros → K:            "Cárdenas" → "Kárdenas"
     *   - LL → Y → I:             "Llanos" → "Ianos"
     *   - X → S al inicio:        "Xavier" → "Savier"
     *
     * Resultado: "Isla", "Ysla", "Hisla", "Hysla" → todos → "isla"
     *            "Vásquez", "Basquez", "Vazquez" → "basques"
     */
    const fonetica = (s: any): string => {
      let t = norm(s);
      if (!t) return '';
      // 1) Quitar H inicial y entre vocales
      t = t.replace(/^h/, '');
      t = t.replace(/([aeiou])h([aeiou])/g, '$1$2');
      // 2) Y → I (siempre — incluso al inicio: "ysla" → "isla")
      t = t.replace(/y/g, 'i');
      // 3) V → B
      t = t.replace(/v/g, 'b');
      // 4) Z → S
      t = t.replace(/z/g, 's');
      // 5) QU → K  (antes de tocar C)
      t = t.replace(/qu/g, 'k');
      // 6) C antes de E/I → S
      t = t.replace(/c([ei])/g, 's$1');
      // 7) Otras C → K
      t = t.replace(/c/g, 'k');
      // 8) LL → I  (en muchos hablantes "Llanos" suena "Ianos")
      t = t.replace(/ll/g, 'i');
      // 9) X inicial → S
      t = t.replace(/^x/, 's');
      // 10) G antes de E/I → J  (suena igual)
      t = t.replace(/g([ei])/g, 'j$1');
      return t;
    };

    const stripLeadingZeros = (s: any): string => {
      const t = String(s ?? '').replace(/^0+/, '');
      return t === '' ? '0' : t;
    };

    // Normalizamos los filtros una sola vez
    const filtroNumOrden = filtros.numOrden ? stripLeadingZeros(filtros.numOrden) : null;
    const palabrasNombre: string[] = [filtros.nombre, filtros.apellido, filtros.nombreCompleto]
      .filter((s): s is string => !!s && !!String(s).trim())
      .flatMap(s => norm(s).split(/\s+/))
      .filter(w => w.length >= 2);   // descartar "y", "de", etc.
    const palabrasFoneticas = palabrasNombre.map(fonetica);
    const filtroAnio = filtros.anio ? String(filtros.anio) : null;
    const filtroMes  = filtros.mes  ? String(filtros.mes).padStart(2, '0') : null;
    const filtroCC   = filtros.centroCosto ? norm(filtros.centroCosto) : null;

    console.log('🎯 [list-orden-pago] normalizados:', {
      filtroNumOrden, palabrasNombre, palabrasFoneticas, filtroAnio, filtroMes, filtroCC,
    });

    const tienenAlgo = filtroNumOrden || palabrasNombre.length || filtroAnio || filtroMes || filtroCC;
    if (!tienenAlgo) {
      // 🆕 BUGFIX 2026-06-26: antes hacíamos `return` y la lista quedaba
      // pegada con el filtro de la consulta anterior. Ahora, si el chat
      // dice "ordenes" sin filtros (o el parser no detectó ninguno),
      // RESETEAMOS a la lista completa para que el usuario vuelva a verlas.
      console.log('🎯 [list-orden-pago] sin filtros activos → limpio el filtro y muestro la lista completa');
      this.ordenes = this.ordenesGeneral;
      this.currentPage = 0;
      this.buildPagination();
      return;
    }

    let descartadosPorNum = 0, descartadosPorNombre = 0, descartadosPorAnio = 0,
        descartadosPorMes = 0, descartadosPorCC = 0;

    this.ordenes = this.ordenesGeneral.filter(orden => {
      // 1) Número de orden
      if (filtroNumOrden) {
        const numLimpio = stripLeadingZeros(orden.numOrden);
        if (numLimpio !== filtroNumOrden && !numLimpio.includes(filtroNumOrden)) {
          descartadosPorNum++;
          return false;
        }
      }

      // 2) Nombre / apellido con fonética.
      //    Para cada palabra del filtro, EXIGIMOS que aparezca en
      //    cdesAuxiliar — comparando primero literalmente y, si falla,
      //    comparando con la huella fonética.
      if (palabrasNombre.length) {
        const aux = norm(orden.cdesAuxiliar);
        if (!aux) {
          descartadosPorNombre++;
          return false;
        }
        const auxPalabras = aux.split(/\s+/);
        const auxFoneticas = auxPalabras.map(fonetica);

        const todasMatchearon = palabrasNombre.every((pal, i) => {
          const palFon = palabrasFoneticas[i];
          // 2a) match literal en cualquier palabra del auxiliar
          if (auxPalabras.some(a => a.includes(pal))) return true;
          // 2b) match fonético (Isla = Ysla = Hisla)
          if (auxFoneticas.some(a => a.includes(palFon))) return true;
          return false;
        });
        if (!todasMatchearon) {
          descartadosPorNombre++;
          return false;
        }
      }

      // 3) Año del periodo.
      if (filtroAnio && String(orden.anoPeriodo || '') !== filtroAnio) {
        descartadosPorAnio++;
        return false;
      }

      // 4) Mes del periodo.
      if (filtroMes && String(orden.codPeriodo || '').padStart(2, '0') !== filtroMes) {
        descartadosPorMes++;
        return false;
      }

      // 5) Centro de Costo.
      if (filtroCC) {
        const cc = norm(orden.codCCostos);
        if (!cc.includes(filtroCC)) {
          descartadosPorCC++;
          return false;
        }
      }

      return true;
    });

    this.currentPage = 0;
    this.buildPagination();

    console.log(`🎯 [list-orden-pago] filtro IA aplicado → ${this.ordenes.length} órdenes` +
      ` (descartados: num=${descartadosPorNum}, nombre=${descartadosPorNombre},` +
      ` año=${descartadosPorAnio}, mes=${descartadosPorMes}, cc=${descartadosPorCC})`);
  }

  private buildPagination(): void {

    this.totalItems = this.ordenes.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);

    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;

    this.pagedOrdenes = this.ordenes.slice(start, end);
  }

  changePage(page: number): void {

    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.buildPagination();
  }

  getOrdenesPago(): void {
    this.ordenPagoService
      .getOrdenesPago(this.wrapperRequestOrdenPago)
      .subscribe({
        next: (response: Response) => {
          this.ordenes = response.resultado || [];
          if (this.isAdminUser == false) {
            this.ordenes = this.ordenes.filter(filtro => filtro.tipEstado == "PR" || filtro.tipEstado == "LQ")
          }
          this.ordenesGeneral = this.ordenes;
          this.currentPage = 0;
          this.buildPagination();
          this.loadingService.hide();
        },
        error: () => {
          this.loadingService.hide();
        }
      });
  }

  onBack(): void {
    this.location.back();
  }

  openModal() {
    this.dialogRef = this.dialog.open(this.orderDialog, {
      width: '90%',
      height: '90%',
      maxWidth: '90%',
      maxHeight: '90%',
      panelClass: 'custom-dialog-container',
      autoFocus: false
    });
  }

  close() {
    this.dialogRef.close();
  }

  onSelectImage(event: Event) {

    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    this.ocrService.uploadFile(file).subscribe(
      (response: any) => {
        console.log('Respuesta del OCR:', response);
        this.imagen.documentType = response.detectedData.documentType;
        this.imagen.documentNumber = response.detectedData.documentNumber;
        this.imagen.issuerRuc = response.detectedData.issuerRuc;
        this.imagen.issuerName = response.detectedData.issuerName;
        this.imagen.issuerAddress = response.detectedData.issuerAddress;
        this.imagen.documentDate = response.detectedData.documentDate;
      }
    );
  }

  viewOrdenesPagoDet(orden: OrdenPago) {
    this.router.navigate(['/list-orders-detail'], { state: { data: orden } });
  }

  filtrarOrdenPago() {

    const term = this.filtrarOrden.toLowerCase();

    if (term) {
      console.log("Term ", term)
      this.ordenes = this.ordenesGeneral.filter(orden => {
        return (
          (orden.codAuxiliar && orden.codAuxiliar.toLowerCase().includes(term)) ||
          (orden.cdesAuxiliar && orden.cdesAuxiliar.toLowerCase().includes(term)) ||
          (orden.numOrden && orden.numOrden.toLowerCase().includes(term)) ||
          (orden.anoPeriodo && orden.anoPeriodo.toLowerCase().includes(term)) ||
          (orden.fecOrden?.toString() && orden.fecOrden.toString().toLowerCase().includes(term)) ||
          (orden.tipEstado && orden.tipEstado.toUpperCase().includes(term.toUpperCase())) ||
          (orden.impOrdPago?.toString() && orden.impOrdPago.toString().toLowerCase().includes(term))
        );
      });

      this.currentPage = 0;
      this.buildPagination();

    } else {

      this.ordenes = this.ordenesGeneral;
      this.currentPage = 0;
      this.buildPagination();
    }
  }

  getStatusTitle(status: string): string {
    switch (status) {
      case 'EM': return 'EMITIDA';
      case 'PE': return 'PENDIENTE';
      case 'LQ': return 'LIQUIDADA';
      default: return '';
    }
  }

  isActionEnabled(state: string, action: string): boolean {
    if (!state) {
      return false;
    }
    return this.stateActions[state]?.[action] || false;
  }

  abrirModalDoc() {
    const modalElement = document.getElementById('modalDocumento');
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement);
      this.modal.show();
    } else {
      console.error('modalDocumento element not found');
    }
  }

  cerrarModalDoc() {
    if (this.modal) {
      this.modal.hide();
    }
  }

  getAsiento(aux: OrdenPago) {
    var wrapper: WrapperRequestVoucherItem = new WrapperRequestVoucherItem();
    wrapper.anoPeriodo = aux.anoPeriodoVou;
    wrapper.codPeriodo = aux.codPeriodoVou;
    wrapper.codEmpresa = aux.codEmpresa;
    wrapper.codTipoComprobante = '06';
    wrapper.numFile = '02';
    wrapper.numVoucher = aux.numVoucher;
    this.conVoucherService.getAsiento(wrapper).subscribe(
      (response: Response) => {
        this.detailsAsiento = response.resultado;
        console.log(this.detailsAsiento);
        if (this.detailsAsiento.length > 0) {
          this.abrirModalDoc();
        }
      }
    )
  }

  getTotal(indDebeHaber: string, moneda: string): number {
    return this.detailsAsiento.reduce((total, item) => {
      return total + (item.indDebeHaber === indDebeHaber ? ((moneda == '01' ? item.impSoles : item.impDolares) || 0) : 0);
    }, 0);
  }

  onPlanillaMovilidad(orden: OrdenPago) {
    this.router.navigate(['/planilla-movilidad'], { state: { data: { orden: orden, movilidad: 'S' } } });
  }

  /* ============================================================
     REPORTE PDF de RENDICIÓN COMPLETA
     ============================================================ */
  generarReporteRendicion(orden: OrdenPago): void {

    this.loadingService.show();

    const wrapperDet = new WrapperRequestOrdenPagoDet();
    wrapperDet.codEmpresa = orden.codEmpresa;
    wrapperDet.codSucursal = orden.codSucursal;
    wrapperDet.numOrden = orden.numOrden;

    const wrapperPlanilla = new WrapperRequestPlanillaMovilidadCab();
    wrapperPlanilla.codEmpresa = orden.codEmpresa;
    wrapperPlanilla.codSucursal = orden.codSucursal;
    wrapperPlanilla.anioPeriodo = orden.anoPeriodo;
    wrapperPlanilla.codPeriodo = orden.codPeriodo;
    wrapperPlanilla.numOrden = orden.numOrden;

    const detalles$ = this.ordenPagoDetService.getOrdenesPagoDet(wrapperDet).pipe(
      map((r: Response) => (r?.resultado as OrdenPagoDetDTO[]) || []),
      catchError(() => of([] as OrdenPagoDetDTO[]))
    );

    const planillas$ = this.planillaCabService.getPlanillaMovilidad(wrapperPlanilla).pipe(
      map((r: Response) => (r?.resultado as OrdenPagoCabPlanilla[]) || []),
      catchError(() => of([] as OrdenPagoCabPlanilla[]))
    );

    forkJoin({ detalles: detalles$, planillas: planillas$ }).subscribe({
      next: ({ detalles, planillas }) => {

        const planillaCalls = (planillas || []).map(p =>
          this.planillaDetService.listarDetalle(
            p.codEmpresa || '',
            p.codSucursal || '',
            p.anioPeriodo || '',
            p.codPeriodo || '',
            p.numOrden || '',
            p.codPlanilla || ''
          ).pipe(
            map((r: Response) => ({
              cab: p,
              det: (r?.resultado as OrdenPagoPlanillaMovilidadDet[]) || []
            })),
            catchError(() => of({
              cab: p,
              det: [] as OrdenPagoPlanillaMovilidadDet[]
            }))
          )
        );

        if (planillaCalls.length === 0) {
          this.construirPDFRendicion(orden, detalles, []);
          this.loadingService.hide();
          return;
        }

        forkJoin(planillaCalls).subscribe({
          next: (planillasDetalladas) => {
            this.construirPDFRendicion(orden, detalles, planillasDetalladas);
            this.loadingService.hide();
          },
          error: () => {
            this.construirPDFRendicion(orden, detalles, []);
            this.loadingService.hide();
          }
        });
      },
      error: () => {
        this.loadingService.hide();
        this.dialog.open(ConfirmDialogComponent, {
          width: '300px',
          data: {
            title: 'Error',
            type: 'alert',
            message: 'No se pudo generar el reporte. Intente nuevamente.'
          }
        });
      }
    });
  }

  /* -------------------- Construcción del PDF -------------------- */
  private construirPDFRendicion(
    orden: OrdenPago,
    detalles: OrdenPagoDetDTO[],
    planillas: { cab: OrdenPagoCabPlanilla; det: OrdenPagoPlanillaMovilidadDet[] }[]
  ): void {

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const usableW = pageW - marginX * 2;

    // Paleta corporativa
    const colors = {
      primary:    [25, 118, 210] as [number, number, number],
      primaryDk:  [13, 71, 161]  as [number, number, number],
      darkText:   [33, 37, 41]   as [number, number, number],
      grayText:   [107, 114, 128] as [number, number, number],
      light:      [243, 244, 246] as [number, number, number],
      border:     [209, 213, 219] as [number, number, number],
      success:    [34, 139, 34]  as [number, number, number],
      danger:     [198, 40, 40]  as [number, number, number],
      whiteText:  [255, 255, 255] as [number, number, number]
    };

    const usuario = (() => {
      try {
        const u = JSON.parse(sessionStorage.getItem('user') || '{}');
        const nombre = [u.userLastName, u.userMiddleName, u.userName].filter(Boolean).join(' ').trim();
        return {
          nombre: nombre || 'Sin nombre',
          username: u.userUsername || '',
          email: u.userEmail || ''
        };
      } catch {
        return { nombre: '', username: '', email: '' };
      }
    })();

    const fechaImpresion = this.formatDateLong(new Date());
    const tituloReporte = 'REPORTE DE RENDICIÓN DE CUENTAS';
    const ordenLabel = `OP N° ${orden.numOrden || '-'}`;

    /* ---------- HEADER ---------- */
    const dibujarEncabezado = () => {
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageW, 28, 'F');

      doc.setFillColor(...colors.primaryDk);
      doc.rect(0, 28, pageW, 2, 'F');

      doc.setTextColor(...colors.whiteText);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('REGINA · Aquarius Consulting', marginX, 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(tituloReporte, marginX, 21);

      // Bloque derecho: ID OP
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(ordenLabel, pageW - marginX, 13, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Emitido: ${fechaImpresion}`, pageW - marginX, 21, { align: 'right' });
    };

    /* ---------- FOOTER ---------- */
    const dibujarPie = (pagActual: number, pagTotal: number) => {
      const yLine = pageH - 18;

      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.3);
      doc.line(marginX, yLine, pageW - marginX, yLine);

      doc.setFontSize(7.5);
      doc.setTextColor(...colors.grayText);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'Documento generado automáticamente por el Sistema Regina · Confidencial · Uso interno',
        marginX, yLine + 5
      );
      doc.text(
        `Aquarius Consulting · soporte@aquariusconsulting.pe`,
        marginX, yLine + 9
      );

      doc.setFont('helvetica', 'bold');
      doc.text(
        `Página ${pagActual} de ${pagTotal}`,
        pageW - marginX, yLine + 5, { align: 'right' }
      );
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${fechaImpresion}`,
        pageW - marginX, yLine + 9, { align: 'right' }
      );
    };

    /* ---------- helpers ---------- */
    const ensureSpace = (y: number, needed: number, ctx: { y: number }): number => {
      if (y + needed > pageH - 28) {
        doc.addPage();
        dibujarEncabezado();
        ctx.y = 36;
        return ctx.y;
      }
      return y;
    };

    const sectionTitle = (text: string, y: number, ctx: { y: number }): number => {
      y = ensureSpace(y, 14, ctx);
      doc.setFillColor(...colors.primary);
      doc.rect(marginX, y, usableW, 7, 'F');
      doc.setTextColor(...colors.whiteText);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(text, marginX + 3, y + 5);
      return y + 11;
    };

    const drawKeyValue = (
      label: string,
      value: string,
      x: number,
      y: number,
      colWidth: number
    ): number => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...colors.grayText);
      doc.text(label.toUpperCase(), x, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...colors.darkText);
      const split = doc.splitTextToSize(value || '—', colWidth);
      doc.text(split, x, y + 4.5);
      return y + 4.5 + split.length * 4;
    };

    const drawTable = (
      headers: string[],
      rows: string[][],
      colWidths: number[],
      y: number,
      ctx: { y: number },
      align: ('L' | 'R' | 'C')[] = []
    ): number => {
      const rowH = 6;
      y = ensureSpace(y, rowH + 6, ctx);

      // Header
      doc.setFillColor(...colors.primaryDk);
      doc.rect(marginX, y, usableW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...colors.whiteText);

      let cx = marginX;
      headers.forEach((h, i) => {
        const a = align[i] || 'L';
        const tx = a === 'R' ? cx + colWidths[i] - 2 : a === 'C' ? cx + colWidths[i] / 2 : cx + 2;
        doc.text(h, tx, y + 4, { align: a === 'R' ? 'right' : a === 'C' ? 'center' : 'left' });
        cx += colWidths[i];
      });
      y += rowH;

      // Body
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      rows.forEach((row, idx) => {
        const lines = row.map((cell, i) =>
          doc.splitTextToSize(cell || '—', colWidths[i] - 4)
        );
        const linesMax = Math.max(...lines.map((l: string[]) => l.length));
        const rowHeight = Math.max(rowH, linesMax * 4 + 2);

        y = ensureSpace(y, rowHeight + 2, ctx);

        // alternating background
        if (idx % 2 === 1) {
          doc.setFillColor(...colors.light);
          doc.rect(marginX, y, usableW, rowHeight, 'F');
        }

        cx = marginX;
        row.forEach((cell, i) => {
          const a = align[i] || 'L';
          doc.setTextColor(...colors.darkText);
          const tx = a === 'R' ? cx + colWidths[i] - 2 : a === 'C' ? cx + colWidths[i] / 2 : cx + 2;
          doc.text(lines[i], tx, y + 4, { align: a === 'R' ? 'right' : a === 'C' ? 'center' : 'left' });
          cx += colWidths[i];
        });
        y += rowHeight;
      });

      // Border
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.2);
      doc.rect(marginX, y - (rows.length === 0 ? 0 : rows.reduce((acc, row) => {
        const lines = row.map((cell, i) => doc.splitTextToSize(cell || '—', colWidths[i] - 4));
        return acc + Math.max(rowH, Math.max(...lines.map((l: string[]) => l.length)) * 4 + 2);
      }, 0)) - rowH, usableW, rows.length === 0 ? rowH : 0);

      return y + 2;
    };

    /* ============================================================
       INICIO
       ============================================================ */
    let y = 36;
    const ctx = { y };
    dibujarEncabezado();

    /* ---------- BLOQUE: DATOS DE LA ORDEN DE PAGO ---------- */
    y = sectionTitle('1. DATOS DE LA ORDEN DE PAGO', y, ctx);

    const colW = usableW / 3;
    let yA = y;
    let yB = y;
    let yC = y;

    yA = drawKeyValue('N° de Orden',         orden.numOrden || '',       marginX,            yA, colW - 4);
    yA = drawKeyValue('Estado',              this.getStatusTitle(orden.tipEstado || ''), marginX, yA + 2, colW - 4);
    yA = drawKeyValue('Beneficiario',        orden.cdesAuxiliar || '',   marginX,            yA + 2, colW - 4);
    yA = drawKeyValue('Cód. Auxiliar',       orden.codAuxiliar || '',    marginX,            yA + 2, colW - 4);

    yB = drawKeyValue('Fecha de Orden',      this.formatDate(orden.fecOrden), marginX + colW,     yB, colW - 4);
    yB = drawKeyValue('Periodo',             `${orden.codPeriodo || ''}/${orden.anoPeriodo || ''}`, marginX + colW, yB + 2, colW - 4);
    yB = drawKeyValue('Fecha de Rendición',  this.formatDate(orden.fecRendicion), marginX + colW, yB + 2, colW - 4);
    yB = drawKeyValue('Días de Rendición',   String(orden.numDiasRendicion ?? '—'), marginX + colW, yB + 2, colW - 4);

    yC = drawKeyValue('Tipo de Gasto',       orden.cdesTipoGasto || '',  marginX + colW * 2, yC, colW - 4);
    yC = drawKeyValue('Centro de Costos',    orden.codCCostos || '',     marginX + colW * 2, yC + 2, colW - 4);
    yC = drawKeyValue('Moneda',              orden.cdesMoneda || '',     marginX + colW * 2, yC + 2, colW - 4);
    yC = drawKeyValue('Importe',             this.formatNumber(orden.impOrdPago), marginX + colW * 2, yC + 2, colW - 4);

    y = Math.max(yA, yB, yC) + 4;

    /* ---------- BLOQUE: RESUMEN GLOSA + IMPORTES ---------- */
    y = ensureSpace(y, 26, ctx);

    doc.setFillColor(...colors.light);
    doc.rect(marginX, y, usableW, 18, 'F');
    doc.setDrawColor(...colors.border);
    doc.rect(marginX, y, usableW, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.grayText);
    doc.text('GLOSA', marginX + 2, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...colors.darkText);
    const glosaText = doc.splitTextToSize(orden.glosa || 'Sin glosa registrada', usableW - 70);
    doc.text(glosaText, marginX + 2, y + 9);

    // Cápsulas a la derecha
    const capW = 30;
    const capX = pageW - marginX - capW;
    doc.setFillColor(...colors.primary);
    doc.rect(capX, y + 2, capW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.whiteText);
    doc.text('IMPORTE OP', capX + capW / 2, y + 6.5, { align: 'center' });
    doc.setFontSize(11);
    doc.text(this.formatNumber(orden.impOrdPago), capX + capW / 2, y + 14, { align: 'center' });

    const totalRendido =
      (orden.codMoneda === '01' ? (orden.impRendidoSoles ?? 0) : 0) +
      (orden.impRendidoDolares ?? 0);

    doc.setFillColor(...colors.success);
    doc.rect(capX - capW - 2, y + 2, capW, 7, 'F');
    doc.setTextColor(...colors.whiteText);
    doc.setFontSize(8);
    doc.text('RENDIDO', capX - capW - 2 + capW / 2, y + 6.5, { align: 'center' });
    doc.setFontSize(11);
    doc.text(this.formatNumber(totalRendido), capX - capW - 2 + capW / 2, y + 14, { align: 'center' });

    y += 22;

    /* ---------- BLOQUE: RENDICIÓN DE COMPROBANTES ---------- */
    y = sectionTitle('2. RENDICIÓN DE COMPROBANTES', y, ctx);

    if (detalles.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...colors.grayText);
      doc.text('No se registraron comprobantes para esta Orden de Pago.', marginX, y + 4);
      y += 10;
    } else {
      const detHeaders = ['#', 'Fecha', 'Doc.', 'Serie-Nro.', 'Glosa', 'Mon.', 'Importe'];
      const detWidths  = [8, 22, 16, 28, usableW - (8 + 22 + 16 + 28 + 14 + 26), 14, 26];
      const detAligns: ('L' | 'R' | 'C')[] = ['C', 'C', 'C', 'C', 'L', 'C', 'R'];

      const rows = detalles.map((d, idx) => [
        String(idx + 1),
        this.formatDate(d.fecDocumento),
        d.codDocumento || '',
        `${d.numSerieDoc || ''}-${d.numDocumento || ''}`,
        d.glosa || '',
        d.codMoneda === '01' ? 'S/' : (d.codMoneda === '02' ? 'US$' : (d.codMoneda || '')),
        this.formatNumber(d.codMoneda === '01' ? (d.impSoles ?? 0) : (d.impDolares ?? 0))
      ]);

      y = drawTable(detHeaders, rows, detWidths, y, ctx, detAligns);

      // totales
      const totSoles = detalles
        .filter(d => d.codMoneda === '01')
        .reduce((acc, d) => acc + (d.impSoles ?? 0), 0);
      const totDolares = detalles
        .filter(d => d.codMoneda === '02')
        .reduce((acc, d) => acc + (d.impDolares ?? 0), 0);

      y = ensureSpace(y, 8, ctx);
      doc.setFillColor(...colors.darkText);
      doc.rect(marginX, y, usableW, 6, 'F');
      doc.setTextColor(...colors.whiteText);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('TOTAL RENDIDO', marginX + 2, y + 4);
      doc.text(`S/ ${this.formatNumber(totSoles)}`, pageW - marginX - 38, y + 4, { align: 'right' });
      doc.text(`US$ ${this.formatNumber(totDolares)}`, pageW - marginX - 2, y + 4, { align: 'right' });
      y += 10;
    }

    /* ---------- BLOQUE: PLANILLAS DE MOVILIDAD ---------- */
    y = sectionTitle('3. PLANILLAS DE MOVILIDAD', y, ctx);

    if (planillas.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...colors.grayText);
      doc.text('No se registraron planillas de movilidad para esta Orden de Pago.', marginX, y + 4);
      y += 10;
    } else {
      planillas.forEach((p, idx) => {

        y = ensureSpace(y, 22, ctx);

        // Sub-cabecera de planilla
        doc.setFillColor(...colors.primary);
        doc.rect(marginX, y, usableW, 6, 'F');
        doc.setTextColor(...colors.whiteText);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(
          `Planilla N° ${p.cab.codPlanilla || (idx + 1)}  ·  ${this.formatDate(p.cab.fechaPlanilla)}`,
          marginX + 2, y + 4
        );
        doc.text(
          `Estado: ${this.getStatusPlanilla(p.cab.statusPlanilla)}`,
          pageW - marginX - 2, y + 4, { align: 'right' }
        );
        y += 8;

        // Datos compactos
        const colsP = usableW / 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...colors.grayText);
        doc.text('CENTRO COSTOS', marginX, y);
        doc.text('RECIBIDO',       marginX + colsP, y);
        doc.text('TOTAL',          marginX + colsP * 2, y);
        doc.text('DEVOLUCIÓN',     marginX + colsP * 3, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...colors.darkText);
        doc.text(p.cab.cCentroCostos || '—',                  marginX, y + 4.5);
        doc.text(this.formatNumber(p.cab.recibido),           marginX + colsP, y + 4.5);
        doc.text(this.formatNumber(p.cab.total),              marginX + colsP * 2, y + 4.5);
        doc.text(this.formatNumber(p.cab.devolucion),         marginX + colsP * 3, y + 4.5);
        y += 8;

        if (p.cab.glosa) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(...colors.grayText);
          const gl = doc.splitTextToSize(`Glosa: ${p.cab.glosa}`, usableW);
          doc.text(gl, marginX, y);
          y += gl.length * 4;
        }

        // Detalle de viajes
        if (p.det.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(...colors.grayText);
          doc.text('Sin viajes registrados.', marginX + 2, y + 4);
          y += 8;
        } else {
          const vHeaders = ['#', 'Fecha', 'Origen', 'Destino', 'Ocupantes', 'Doc.', 'Glosa', 'Importe'];
          const restW = usableW - (8 + 22 + 26 + 26 + 18 + 16 + 24);
          const vWidths = [8, 22, 26, 26, 18, 16, restW, 24];
          const vAligns: ('L' | 'R' | 'C')[] = ['C', 'C', 'L', 'L', 'C', 'C', 'L', 'R'];

          const rows = p.det.map((d, i) => [
            String(i + 1),
            this.formatDate(d.fecItemPlanilla),
            d.codOrigen || '',
            d.codDestino || '',
            d.ocupantes || '',
            `${d.codDocumento || ''}${d.numDocumento ? ' ' + d.numDocumento : ''}`,
            d.glosa || '',
            this.formatNumber(d.importe)
          ]);

          y = drawTable(vHeaders, rows, vWidths, y, ctx, vAligns);

          // sub-total
          const subTot = p.det.reduce((a, d) => a + (d.importe ?? 0), 0);
          y = ensureSpace(y, 7, ctx);
          doc.setFillColor(...colors.darkText);
          doc.rect(marginX, y, usableW, 5.5, 'F');
          doc.setTextColor(...colors.whiteText);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(`SUB-TOTAL Planilla N° ${p.cab.codPlanilla || (idx + 1)}`, marginX + 2, y + 4);
          doc.text(this.formatNumber(subTot), pageW - marginX - 2, y + 4, { align: 'right' });
          y += 9;
        }
      });
    }

    /* ---------- BLOQUE: RESUMEN FINAL ---------- */
    y = sectionTitle('4. RESUMEN GENERAL', y, ctx);

    const totalDetalles = detalles.reduce(
      (a, d) => a + ((d.codMoneda === '01' ? d.impSoles : d.impDolares) ?? 0),
      0
    );
    const totalPlanillas = planillas.reduce(
      (a, p) => a + p.det.reduce((b, d) => b + (d.importe ?? 0), 0),
      0
    );
    const totalGeneral = totalDetalles + totalPlanillas;
    const saldo = (orden.impOrdPago ?? 0) - totalGeneral;

    y = ensureSpace(y, 28, ctx);

    const boxW = (usableW - 12) / 4;

    const drawSummary = (
      x: number,
      label: string,
      val: string,
      bg: [number, number, number]
    ) => {
      doc.setFillColor(...bg);
      doc.rect(x, y, boxW, 22, 'F');
      doc.setTextColor(...colors.whiteText);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(label, x + boxW / 2, y + 7, { align: 'center' });
      doc.setFontSize(13);
      doc.text(val, x + boxW / 2, y + 16, { align: 'center' });
    };

    drawSummary(marginX, 'IMPORTE OP', this.formatNumber(orden.impOrdPago), colors.primaryDk);
    drawSummary(marginX + boxW + 4, 'COMPROBANTES', this.formatNumber(totalDetalles), colors.primary);
    drawSummary(marginX + (boxW + 4) * 2, 'MOVILIDAD', this.formatNumber(totalPlanillas), [13, 71, 161]);
    drawSummary(
      marginX + (boxW + 4) * 3,
      saldo >= 0 ? 'SALDO A FAVOR' : 'SALDO EXCEDIDO',
      this.formatNumber(Math.abs(saldo)),
      saldo >= 0 ? colors.success : colors.danger
    );

    y += 26;

    /* ---------- BLOQUE: ESPACIO DE FIRMAS ---------- */
    y = ensureSpace(y, 60, ctx);
    y += 6;

    const firmaW = (usableW - 16) / 2;

    const drawFirma = (x: number, titulo: string, subtitulo: string) => {
      // línea
      doc.setDrawColor(...colors.darkText);
      doc.setLineWidth(0.4);
      doc.line(x + 5, y + 28, x + firmaW - 5, y + 28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...colors.darkText);
      doc.text(titulo, x + firmaW / 2, y + 33, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...colors.grayText);
      doc.text(subtitulo, x + firmaW / 2, y + 38, { align: 'center' });

      // marco sutil
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.2);
      doc.rect(x, y, firmaW, 42);
    };

    drawFirma(
      marginX,
      usuario.nombre.toUpperCase(),
      `Responsable de la OP · ${usuario.username || '—'}`
    );
    drawFirma(
      marginX + firmaW + 16,
      'V° B° SUPERVISOR',
      'Aprobación / Conformidad'
    );

    y += 50;

    /* ---------- NOTA LEGAL ---------- */
    y = ensureSpace(y, 12, ctx);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.grayText);
    const nota = doc.splitTextToSize(
      'El presente reporte consolida la información de comprobantes y planillas de movilidad asociados ' +
      'a la Orden de Pago indicada. Los importes se expresan en la moneda original. Cualquier discrepancia ' +
      'deberá ser comunicada al área de Contabilidad dentro de los siguientes 5 días hábiles.',
      usableW
    );
    doc.text(nota, marginX, y);

    /* ---------- DIBUJAR PIES ---------- */
    const totalPag = (doc as any).getNumberOfPages
      ? (doc as any).getNumberOfPages()
      : doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPag; i++) {
      doc.setPage(i);
      dibujarPie(i, totalPag);
    }

    const filename = `Rendicion_OP_${orden.numOrden || 'SN'}_${new Date().getTime()}.pdf`;

    // 1) DESCARGA del archivo
    doc.save(filename);

    // 2) VISUALIZACIÓN en nueva pestaña del navegador
    try {
      const blob: Blob = doc.output('blob') as Blob;
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        // Si el navegador bloqueó el popup, dejamos un fallback con anchor
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // Liberar memoria luego de un tiempo prudente
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      console.warn('No se pudo abrir la vista previa del PDF', e);
    }
  }

  /* -------------------- helpers de formato -------------------- */
  private formatNumber(n?: number | null): string {
    const v = typeof n === 'number' ? n : 0;
    return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatDate(d?: Date | string | null): string {
    if (!d) return '—';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = dt.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  private formatDateLong(d: Date): string {
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'];
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  private getStatusPlanilla(status?: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PE': return 'Pendiente';
      case 'CE': return 'Cerrada';
      case 'AP': return 'Aprobada';
      case 'AN': return 'Anulada';
      default:   return status || '—';
    }
  }

  openEditRendirCuenta(orden: OrdenPago) {
    const hoy = new Date();
    if (orden.fecRendicion) {

      const fechaRendicion = new Date(orden.fecRendicion);

      if (fechaRendicion.getTime() < hoy.getTime()) {
        console.log("Fecha de Rendición vencida");
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          width: '280px',
          disableClose: true,
          data: {
            title: 'Alerta',
            message: MessageRenderAccount.FECHA_VENCIMIENTO,
            type: 'alert',
            autoClose: true,
            duration: 2000
          }
        });
      }
      this.router.navigate(['/edit-rendir-cuenta'], { state: { data: { orden: orden, movilidad: 'N' } } });
    }
  }
}
