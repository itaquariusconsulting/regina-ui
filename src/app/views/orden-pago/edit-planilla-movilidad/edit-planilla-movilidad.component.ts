import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import moment from 'moment'
import Swal from 'sweetalert2';
import * as bootstrap from 'bootstrap';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { PdfViewerComponent } from '../../../components/pdf-viewer/pdf-viewer.component';
import { normalizarArchivoCamara, comprimirImagenParaOcr } from '../../../shared/utils/mobile-file.util';
import { formatHttpError, errorHtml } from '../../../shared/utils/error-detail.util';
import { Observable, finalize, forkJoin } from 'rxjs';
import { OrdenPago } from '../../../models/orden-pago';
import { DeviceService } from '../../../services/core-service/device.service';
import { Response } from '../../../models/response';
import { MaeCentroCostrosDTO } from '../../../models/mae-centro-costos';
import { MaestrosService } from '../../../services/maestros.service';
import { MaeBanco } from '../../../models/mae-banco';
import { OrdenPagoCabPlanilla } from '../../../models/orden-pago-planilla-movilidad-cab';
import { NgxCurrencyDirective } from 'ngx-currency';
import { OrdenPagoPlanillaMovilidadDet } from '../../../models/orden-pago-planilla-movilidad-det';
import { MaeDocumento } from '../../../models/mae-documento';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import { OrdenPagoPlanillaMovilidadDetService } from '../../../services/orden-pago-planilla-movilidad-det.service';
import { OrdenPagoPlanillaMovilidadCabService } from '../../../services/orden-pago-planilla-movilidad-cab.service';
import { WrapperRequestPlanillaMovilidadCab } from '../../../models/wrappers/wrapper-request-planilla-movilidad-cab';
import { MaeAuxiliarDTO } from '../../../models/mae-auxiliar-dto';
import { MaeUbigeo, TipoUbigeo } from '../../../models/mae-ubigeo';
import { RegSecUserService } from '../../../services/reg-sec-user.service';
import { WrapperRequestUsuario } from '../../../models/wrappers/wrapper-request-usuario';
import { RegSecUser } from '../../../models/reg-sec-user';
import { OcrService } from '../../../services/ocr.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentoService } from '../../../services/documento.service';
import { OrdenPagoDetService } from '../../../services/orden-pago-det.service';
import { WrapperUploadDocumento } from '../../../models/wrappers/wrapper-upload-documento';
import { WrapperRequestDocumebtoExistente } from '../../../models/wrappers/wrapper-request-documento-existente';
import { MatDialog } from '@angular/material/dialog';
import { LegibilityChoiceDialogComponent, LegibilityChoice } from '../../../components/dialogs/legibility-choice-dialog.component';

@Component({
  selector: 'app-edit-planilla-movilidad',
  providers: [
    provideMomentDateAdapter({
      parse: {
        dateInput: 'DD/MM/YYYY',
      },
      display: {
        dateInput: 'DD/MM/YYYY',
        monthYearLabel: 'MMM YYYY',
        dateA11yLabel: 'DD/MM/YYYY',
        monthYearA11yLabel: 'MMMM YYYY',
      },
    }),
    { provide: MAT_DATE_LOCALE, useValue: 'es' }
  ],
  imports: [CommonModule, FormsModule, MatDatepickerModule,
    MatInputModule,
    MatFormFieldModule,
    LoadingDancingSquaresComponent,
    NgxCurrencyDirective,
    PdfViewerComponent],
  templateUrl: './edit-planilla-movilidad.component.html',
  styleUrl: './edit-planilla-movilidad.component.scss'
})
export class EditPlanillaMovilidadComponent implements OnInit {
  constructor(
    private location: Location,
    private deviceService: DeviceService,
    private loadingService: LoadingService,
    private maestrosService: MaestrosService,
    private planillaDetService: OrdenPagoPlanillaMovilidadDetService,
    private planillaCabService: OrdenPagoPlanillaMovilidadCabService,
    private regSecUserService: RegSecUserService,
    private ocrService: OcrService,
    private sanitizer: DomSanitizer,
    private documentoService: DocumentoService,
    private ordenPagoDetService: OrdenPagoDetService,
    private dialog: MatDialog
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  /** Score mínimo del OCR para considerar "legible" (regla 60). */
  private static readonly LEGIBLE_MIN_SCORE = 60;
  /** Último score reportado por el OCR para el archivo cargado. */
  scoreOcrMov: number = 0;
  /** True cuando se detecta duplicado RUC+Tipo+Serie+Núm en BD. */
  esDuplicadoMov: boolean = false;
  mensajeDuplicadoMov: string = '';

  // ─── Carga de comprobante (PDF/Imagen) + OCR ──────────────────────────
  /** Archivo seleccionado por el usuario (PDF o imagen). */
  selectedFileMov: File | null = null;
  /** Preview en data-URL para imágenes (no aplica a PDF). */
  previewImageMov: string | null = null;
  /** URL segura para incrustar el PDF en un <iframe>. */
  pdfPreviewUrlMov: SafeResourceUrl | null = null;
  /**
   * URL cruda (blob:) del PDF para el visor PDF.js. El componente
   * `<app-pdf-viewer>` no acepta `SafeResourceUrl` porque trabaja
   * directamente con el binario; necesita el string plano.
   */
  pdfPreviewRawUrlMov: string | null = null;
  /** True cuando el archivo es PDF (se muestra iframe en lugar de img). */
  showPdfPreviewMov: boolean = false;
  /** Bandera para deshabilitar botones mientras se procesa el OCR. */
  cargandoOcrMov: boolean = false;
  /** Texto del último mensaje de estado del OCR (éxito/error). */
  mensajeOcrMov: string = '';

  isLoading$: Observable<boolean>;
  orden: OrdenPago = new OrdenPago();
  isDesktop: boolean = false;
  centroCostos: MaeCentroCostrosDTO[] = [];
  centro: MaeCentroCostrosDTO = new MaeCentroCostrosDTO();
  bancos: MaeBanco[] = [];
  banco: string = "";
  ordenPagoPlanillaMovilidadCab: OrdenPagoCabPlanilla = new OrdenPagoCabPlanilla();
  pagedViajes: OrdenPagoPlanillaMovilidadDet[] = [];
  pageSize = 4;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;

  pageSizeAux = 7;
  currentPageAux = 0;
  totalItemsAux = 0;
  totalPagesAux = 0;

  pageSizeUbigeos = 7;
  currentPageUbigeos = 0;
  totalItemsUbigeos = 0;
  totalPagesUbigeos = 0;
  
  pageSizeUsers = 7;
  currentPageUsers = 0;
  totalItemsUsers = 0;
  totalPagesUsers = 0;

  listaMovilidad: OrdenPagoPlanillaMovilidadDet[] = [];
  documentosGeneral: MaeDocumento[] = [];
  modelPlanillaIni: moment.Moment | null = moment();
  minDate = moment('2020-01-01');
  maxDate = moment('2030-12-31');
  modal: any;
  modalAuxiliares: any;
  modalUbigeos: any;
  modalOcupantes: any;
  modalUsuarios: any;
  nuevoDetalle: OrdenPagoPlanillaMovilidadDet = new OrdenPagoPlanillaMovilidadDet();
  nuevoDetalleFecha: string = '';
  guardandoDetalle: boolean = false;
  guardandoCabecera: boolean = false;
  auxiliaresPR: MaeAuxiliarDTO[] = [];
  auxiliarSeleccionado: MaeAuxiliarDTO | null = null;
  pagedViajesAux: MaeAuxiliarDTO[] = [];
  ocupantesSeleccionados: RegSecUser[] = [];
  ocupantesModalNombres: string[] = [];

  ubigeos: MaeUbigeo[] = [];
  ubigeosGeneral: MaeUbigeo[] = [];

  usuarios: RegSecUser[] = [];
  pagedUsuariosModal: RegSecUser[] = [];
  wrapperRequestUsuario: WrapperRequestUsuario = new WrapperRequestUsuario();

  /** Texto del buscador del modal de ocupantes (filtra por nombre, username o email). */
  searchUsuarios: string = '';
  /** Subconjunto de `usuarios` que cumple el filtro actual (sobre este se pagina). */
  private filteredUsuarios: RegSecUser[] = [];

  searchUbigeo: string = '';
  pagedUbigeos: MaeUbigeo[] = [];
  tipoUbigeo: number = -1;

  origenSeleccionado: MaeUbigeo | null = null;
  destinoSeleccionado: MaeUbigeo | null = null;

  viewOnly: boolean = false;

  ngOnInit(): void {
    this.initializeComponentData();
    this.setupUI();
    this.initUsuarioWrapper();
    this.loadRequiredCatalogs();
  }

  /** Importe máximo permitido por día (regla MOVILIDAD_MAX_DIA en REG_REN_VALIDATE) */
  importeMaxDia: number = 45.20;
  /** Mensaje configurado en la regla para mostrar al usuario al exceder el tope */
  importeMaxDiaErrorMsg: string = '';

  private initializeComponentData(): void {
    const { data } = history.state || {};
    if (!data) return;

    this.orden = data.orden ?? data;
    this.ordenPagoPlanillaMovilidadCab = data.planilla ?? new OrdenPagoCabPlanilla();
    this.viewOnly = !!data.viewOnly;

    // Regla de importe máximo por día (viene desde el listado de planillas)
    if (typeof data.importeMaxDia === 'number' && data.importeMaxDia > 0) {
      this.importeMaxDia = data.importeMaxDia;
    }
    if (typeof data.importeMaxDiaErrorMsg === 'string' && data.importeMaxDiaErrorMsg.trim()) {
      this.importeMaxDiaErrorMsg = data.importeMaxDiaErrorMsg;
    }

    if (this.orden?.fecOrden) {
      this.minDate = moment(this.orden.fecOrden);
    }
  }

  private setupUI(): void {
    this.isDesktop = this.deviceService.isDesktopDevice();
    this.buildPagination();
    this.getCentroCostos();
  }

  private initUsuarioWrapper(): void {
    const userString = sessionStorage.getItem('user');
    if (userString) {
      try {
        const user = JSON.parse(userString);
        this.wrapperRequestUsuario.codEmpresa = user.codEmpresa || '';
        this.wrapperRequestUsuario.codSucursal = user.codSucursal || '';
      } catch (e) {
        console.error('Error al parsear User desde sessionStorage', e);
      }
    }

    if (!this.wrapperRequestUsuario.codEmpresa) {
      this.wrapperRequestUsuario.codEmpresa = this.empresaId;
    }
    if (!this.wrapperRequestUsuario.codSucursal) {
      this.wrapperRequestUsuario.codSucursal = this.orden?.codSucursal ?? '001';
    }
  }

  private loadRequiredCatalogs(): void {
    this.loadingService.show();

    forkJoin({
      centros: this.maestrosService.getCentroCostos(this.empresaId, "001"),
      bancos: this.maestrosService.getBancos(this.empresaId),
      documentos: this.maestrosService.getTiposDocumento(this.empresaId),
      ubigeos: this.maestrosService.getUbigeos(),
      auxiliares: this.maestrosService.getListaAuxiliaresPR(this.empresaId),
      usuarios: this.regSecUserService.getRegSecUsers(this.wrapperRequestUsuario)
    }).subscribe({
      next: (res:any) => {
        this.centroCostos = res.centros.resultado;
        this.centro = this.centroCostos.find(cc => cc.codCCostos === this.orden.codCCostos) ?? new MaeCentroCostrosDTO();
        this.bancos = res.bancos.resultado;
        this.banco = this.bancos?.[0]?.codAuxiliar ?? '';
        this.documentosGeneral = res.documentos.resultado;
        this.ubigeos = res.ubigeos.resultado;
        this.ubigeosGeneral = [...this.ubigeos];
        this.auxiliaresPR = res.auxiliares.resultado;
        this.usuarios = res.usuarios.resultado || [];

        this.buildPaginationUbigeos();
        this.buildPaginationAuxiliares();
        this.buildPaginationUsuarios();

        this.loadPlanillaData();
      },
      error: () => this.loadingService.hide()
    });
  }

  private loadPlanillaData(): void {
    if (this.ordenPagoPlanillaMovilidadCab?.codPlanilla) {
      this.mapHeaderData(this.ordenPagoPlanillaMovilidadCab);
      this.loadPlanillaDetails();
    } else {
      const params = this.getOrderParams();
      const hasParams = Object.values(params).every(val => !!val);

      if (hasParams) {
        this.loadPlanillaHeader();
      } else {
        this.loadingService.hide();
      }
    }
  }

  private get empresaId(): string {
    return this.orden?.codEmpresa ?? '0001';
  }

  getCentroCostos(): void {
    this.loadingService.show();
    this.maestrosService.getCentroCostos(this.empresaId, "001").subscribe({
      next: (response: Response) => {
        this.centroCostos = response.resultado;
        const foundCentro = this.centroCostos.find(cc => cc.codCCostos === this.orden.codCCostos);
        this.centro = foundCentro ?? new MaeCentroCostrosDTO();
        this.getBancos();
      },
      error: (err) => {
        console.error("No se pudo obtener la lista de Centros de Costos", err);
      }
    });
  }

  getBancos(): void {
    this.maestrosService.getBancos(this.empresaId).subscribe({
      next: (response: Response) => {
        this.bancos = response.resultado;
        this.banco = this.bancos?.[0]?.codAuxiliar ?? '';
        this.getDocumentos();
      },
      error: (err) => {
        console.error("No se pudo obtener la lista de Bancos", err);
      }
    });
  }

  getDocumentos(): void {
    this.maestrosService.getTiposDocumento(this.empresaId).subscribe({
      next: (response: Response) => {
        this.documentosGeneral = response.resultado;
        this.getUbigeos();
      },
      error: (err) => {
        console.error("No se pudo obtener la lista de Documentos", err);
      }
    });
  }

  getUbigeos(): void {
    this.maestrosService.getUbigeos()
      .subscribe({
        next: (response: Response) => {
          const { resultado } = response;
          this.ubigeos = resultado;
          this.ubigeosGeneral = resultado;
          this.currentPageUbigeos = 0;

          this.buildPaginationUbigeos();
          this.getAuxiliaresPR();
        },
        error: (err) => {
          console.error("No se pudo obtener la lista de ubigeos", err);
        }
      });
  }

  filterUbigeos(): void {
    const searchTerm = this.searchUbigeo?.toLowerCase().trim();
    if (!searchTerm) {
      this.ubigeos = [...this.ubigeosGeneral];
    } else {
      this.ubigeos = this.ubigeosGeneral.filter(u => {
        return [u.desDepartamento, u.desProvincia, u.desDistrito].some(field =>
          field?.toLowerCase().includes(searchTerm)
        );
      });
    }
    this.currentPageUbigeos = 0;
    this.buildPaginationUbigeos();
  }

  selectUbigeos(ubigeo: MaeUbigeo): void {
    if (this.tipoUbigeo === TipoUbigeo.Origen) {
      this.nuevoDetalle.codOrigen = ubigeo.codUbigeo ?? '';
      this.origenSeleccionado = ubigeo;
    } else if (this.tipoUbigeo === TipoUbigeo.Destino) {
      this.nuevoDetalle.codDestino = ubigeo.codUbigeo ?? '';
      this.destinoSeleccionado = ubigeo;
    }
    this.closeUbigeosModal();
  }

  getAuxiliaresPR(): void {
    this.maestrosService.getListaAuxiliaresPR(this.empresaId).subscribe({
      next: (response: Response) => {
        this.auxiliaresPR = response.resultado;
        this.currentPageAux = 0;
        this.buildPaginationAuxiliares();
      },
      error: (err) => {
        console.error("No se pudo obtener la lista de Auxiliares PR", err);
      },
      complete: () => this.loadingService.hide()
    });
  }

  onBack(): void {
    this.location.back();
  }

  devolverDocumento(tipoDoc: string): string {
    return this.documentosGeneral
      .find(doc => doc.codDocumento == tipoDoc)
      ?.desDocumento ?? '';
  }

  mapAuxilarName(cod: string | undefined | null): string {
    if (!cod) return '';
    const aux = this.auxiliaresPR.find(x => x.codAuxiliar === cod);
    return aux ? aux.desAuxiliar! : cod;
  }

  mapUbigeoText(cod: string | undefined | null): string {
    if (!cod) return '';
    const u = this.ubigeosGeneral.find(x => x.codUbigeo === cod);
    return u ? `${u.desDepartamento}-${u.desProvincia}-${u.desDistrito}` : cod;
  }

  private buildPagination(): void {
    this.totalItems = this.listaMovilidad.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);

    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;

    this.pagedViajes = this.listaMovilidad.slice(start, end);
  }

  private buildPaginationAuxiliares(): void {
    this.totalItemsAux = this.auxiliaresPR.length;
    this.totalPagesAux = Math.ceil(this.totalItemsAux / this.pageSizeAux);

    const start = this.currentPageAux * this.pageSizeAux;
    const end = start + this.pageSizeAux;

    this.pagedViajesAux = this.auxiliaresPR.slice(start, end);
  }

  private buildPaginationUsuarios(): void {
    // 1. Filtrar primero según el texto del buscador
    const term = (this.searchUsuarios || '').trim().toLowerCase();
    if (!term) {
      this.filteredUsuarios = [...this.usuarios];
    } else {
      this.filteredUsuarios = this.usuarios.filter(user => {
        const display = this.getUserDisplayName(user).toLowerCase();
        const username = (user.userUsername || '').toLowerCase();
        const email = (user.userEmail || '').toLowerCase();
        return display.includes(term) || username.includes(term) || email.includes(term);
      });
    }

    // 2. Paginar el resultado filtrado
    this.totalItemsUsers = this.filteredUsuarios.length;
    this.totalPagesUsers = Math.max(1, Math.ceil(this.totalItemsUsers / this.pageSizeUsers));

    // Si el filtro redujo la lista por debajo de la página actual, retrocedemos
    if (this.currentPageUsers >= this.totalPagesUsers) {
      this.currentPageUsers = 0;
    }

    const start = this.currentPageUsers * this.pageSizeUsers;
    const end = start + this.pageSizeUsers;
    this.pagedUsuariosModal = this.filteredUsuarios.slice(start, end);
  }

  /** Se dispara cuando el usuario escribe en el buscador del modal de ocupantes. */
  onSearchUsuariosChange(): void {
    this.currentPageUsers = 0;
    this.buildPaginationUsuarios();
  }

  private buildPaginationUbigeos(): void {
    this.totalItemsUbigeos = this.ubigeos.length;
    this.totalPagesUbigeos = Math.ceil(this.totalItemsUbigeos / this.pageSizeUbigeos);

    const start = this.currentPageUbigeos * this.pageSizeUbigeos;
    const end = start + this.pageSizeUbigeos;

    this.pagedUbigeos = this.ubigeos.slice(start, end);
  }

  changePage(page: number): void {
    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.buildPagination();
  }

  changePageAuxiliares(page: number): void {
    if (page < 0 || page >= this.totalPagesAux) {
      return;
    }

    this.currentPageAux = page;
    this.buildPaginationAuxiliares();
  }

  changePageUsuarios(page: number): void {
    if (page < 0 || page >= this.totalPagesUsers) {
      return;
    }

    this.currentPageUsers = page;
    this.buildPaginationUsuarios();
  }

  changePageUbigeos(page: number): void {
    if (page < 0 || page >= this.totalPagesUbigeos) {
      return;
    }
    this.currentPageUbigeos = page;
    this.buildPaginationUbigeos();
  }

  private getOrderParams() {
    const { codEmpresa, codSucursal, anioPeriodo, codPeriodo, numOrden, codPlanilla } = this.ordenPagoPlanillaMovilidadCab;
    return {
      codEmpresa: codEmpresa ?? '',
      codSucursal: codSucursal ?? '',
      anioPeriodo: anioPeriodo ?? '',
      codPeriodo: codPeriodo ?? '',
      numOrden: numOrden ?? '',
      codPlanilla: codPlanilla ?? ''
    };
  }

  private resetListState(): void {
    this.listaMovilidad = [];
    this.currentPage = 0;
    this.buildPagination();
  }

  private loadPlanillaDetails(): void {
    this.loadingService.show();

    const params = this.getOrderParams();
    this.planillaDetService.listarDetalle(
      params.codEmpresa,
      params.codSucursal,
      params.anioPeriodo,
      params.codPeriodo,
      params.numOrden,
      params.codPlanilla
    ).pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (response: any) => {
          this.listaMovilidad = response.resultado || [];
          console.log("Lista de detalles de movilidad: ", this.listaMovilidad);
          this.currentPage = 0;
          this.buildPagination();
        },
        error: () => this.resetListState()
      });
  }

  private loadPlanillaHeader(): void {
    this.loadingService.show();
    const params = this.getOrderParams();

    if (Object.values(params).some(val => !val)) return;

    const wrapper: WrapperRequestPlanillaMovilidadCab = { ...params };
    this.planillaCabService.getPlanillaMovilidad(wrapper)
      .pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (response: any) => {
          const planillas = response.resultado || [];
          if (planillas.length > 0) {
            const lastPlanilla = planillas[planillas.length - 1];
            this.mapHeaderData(lastPlanilla);
            this.loadPlanillaDetails();
          } else {
            this.resetListState();
          }
        }
      });
  }

  private mapHeaderData(data: any): void {
    const cab = this.ordenPagoPlanillaMovilidadCab;
    cab.codPlanilla = data.codPlanilla;
    cab.maxNumViajes = data.maxNumViajes;
    cab.total = data.total;
    cab.glosa = data.glosa;

    const fecha = data.fechaPlanilla;
    if (fecha) {
      this.modelPlanillaIni = moment(fecha);
    }
  }

  openDetailModal(): void {
    this.nuevoDetalle = new OrdenPagoPlanillaMovilidadDet();
    this.nuevoDetalleFecha = new Date().toISOString().slice(0, 10);
    this.resetOcupantes();

    Object.assign(this.nuevoDetalle, this.getOrderParams(), {
      codPlanilla: this.ordenPagoPlanillaMovilidadCab.codPlanilla ?? ''
    });

    const modalElement = document.getElementById('modalNuevoDetalle');
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement);
      this.modal.show();
    }
  }

  closeDetailModal(): void {
    this.modal?.hide();
    this.auxiliarSeleccionado = null;
    this.origenSeleccionado = null;
    this.destinoSeleccionado = null;
    this.resetOcupantes();
    this.onDescartarImagenMov();
  }

  // ────────────────────────────────────────────────────────────────────
  //  Carga de PDF/Imagen del comprobante y OCR (igual que Rendir Cuenta)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Handler del input type="file". Acepta imagen o PDF, muestra el preview
   * y lanza automáticamente el OCR para precargar los campos.
   */
  async onSelectFileMov(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const fileRaw = input.files[0];

    // 1) Renombrar para que el backend no falle por nombre inseguro.
    let file = normalizarArchivoCamara(fileRaw, 'movilidad');

    // 2) Comprimir si es imagen — los recibos de inDrive/Uber a veces
    //    son screenshots de 3+ MB; los reducimos a ~1 MB para acelerar
    //    el upload y el OCR.
    const tamanoOriginal = file.size;
    file = await comprimirImagenParaOcr(file);
    if (file.size !== tamanoOriginal) {
      console.info(`[planilla-movilidad] imagen comprimida: ${(tamanoOriginal/1024).toFixed(0)} KB → ${(file.size/1024).toFixed(0)} KB`);
    }
    this.selectedFileMov = file;

    // Generar preview según el tipo
    if (file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      this.pdfPreviewUrlMov = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      this.pdfPreviewRawUrlMov = url; // para <app-pdf-viewer>
      this.previewImageMov = null;
      this.showPdfPreviewMov = true;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewImageMov = e.target?.result as string;
        this.pdfPreviewUrlMov = null;
        this.pdfPreviewRawUrlMov = null;
        this.showPdfPreviewMov = false;
      };
      reader.readAsDataURL(file);
    }

    // Reset del input para que pueda recargar el mismo archivo
    input.value = '';

    // Auto-procesar OCR al subir
    this.procesarOcrMov(false);
  }

  /**
   * Envía el archivo al servicio OCR. Si `enhance=true` aplica la mejora
   * de nivel 3 antes del reconocimiento (útil para comprobantes ilegibles).
   */
  procesarOcrMov(enhance: boolean): void {
    if (!this.selectedFileMov) {
      Swal.fire({
        icon: 'info',
        title: 'Sin archivo',
        text: 'Primero suba un PDF o imagen del comprobante.'
      });
      return;
    }
    this.cargandoOcrMov = true;
    this.mensajeOcrMov = enhance
      ? 'Mejorando imagen y reprocesando OCR…'
      : 'Procesando OCR del comprobante…';

    this.ocrService.uploadFile(this.selectedFileMov, enhance).subscribe({
      next: (response: any) => {
        this.cargandoOcrMov = false;

        // ───── LOGS DETALLADOS PARA DIAGNÓSTICO ─────────────────────────
        console.group('%c[OCR Movilidad] Respuesta del servidor', 'color:#1f3864;font-weight:bold;');
        console.log('🔵 Respuesta completa:', response);
        console.log('🔵 JSON formateado:\n', JSON.stringify(response, null, 2));
        console.groupEnd();
        // ────────────────────────────────────────────────────────────────

        // El backend OCR devuelve los datos en `response.detectedData` (mismo
        // contrato que usa rendir-cuenta). Mantenemos fallbacks por si la
        // forma cambia en algún momento.
        const detected = response?.detectedData
                      ?? response?.resultado
                      ?? response?.data
                      ?? response;

        if (!detected || typeof detected !== 'object') {
          this.mensajeOcrMov = 'El OCR no devolvió datos. Complete los campos manualmente.';
          console.warn('[OCR Movilidad] sin datos:', response);
          return;
        }

        // ───── LOGS DETALLADOS DE LO DETECTADO ──────────────────────────
        console.group('%c[OCR Movilidad] Campos detectados', 'color:#28a745;font-weight:bold;');
        console.log('🟢 ¿Es recibo de movilidad?', detected.isMobility ?? false);
        console.log('🟢 Tipo Documento     :', detected.documentType);
        console.log('🟢 Número Documento   :', detected.documentNumber);
        console.log('🟢 Fecha              :', detected.documentDate);
        console.log('🟢 Moneda             :', detected.documentCurrency);
        console.log('🟢 Importe            :', detected.amount);
        console.log('🟢 RUC emisor         :', detected.issuerRuc);
        console.log('🟢 Razón social       :', detected.issuerName);
        console.log('🟢 Nombre comercial   :', detected.commercialName);
        console.log('🟢 Dirección emisor   :', detected.issuerAddress);
        // ─── Campos específicos de movilidad ───
        console.log('🚖 Chofer             :', detected.driverName);
        console.log('🚖 Vehículo           :', detected.vehicle);
        console.log('🚖 Tipo de servicio   :', detected.serviceType);
        console.log('🚖 Pick-up (origen)   :', detected.pickupAddress);
        console.log('🚖 Drop-off (destino) :', detected.dropoffAddress);
        console.log('🚖 Hora salida        :', detected.pickupTime);
        console.log('🚖 Hora llegada       :', detected.dropoffTime);
        console.log('🚖 Distancia          :', detected.distance);
        console.log('🚖 Glosa sugerida     :', detected.glosaSugerida);
        console.log('🟢 detected completo  :', detected);
        console.groupEnd();
        // ────────────────────────────────────────────────────────────────

        this.mapDetectedToDetalleMov(detected);

        // ───── ESTADO DEL FORMULARIO DESPUÉS DEL MAPEO ──────────────────
        console.group('%c[OCR Movilidad] Estado del formulario tras mapeo', 'color:#b7791f;font-weight:bold;');
        console.log('🟡 Fecha              :', this.nuevoDetalleFecha);
        console.log('🟡 codDocumento       :', this.nuevoDetalle.codDocumento);
        console.log('🟡 numDocumento       :', this.nuevoDetalle.numDocumento);
        console.log('🟡 Importe            :', this.nuevoDetalle.importe);
        console.log('🟡 Glosa              :', this.nuevoDetalle.glosa);
        console.log('🟡 Dir. Origen        :', this.nuevoDetalle.dirOrigen);
        console.log('🟡 Dir. Destino       :', this.nuevoDetalle.dirDestino);
        console.groupEnd();
        // ────────────────────────────────────────────────────────────────

        // Score de legibilidad: si está bajo, ofrecemos opciones al usuario.
        const scoreRaw = response?.legibilityScore
                      ?? detected?.legibilityScore
                      ?? detected?.score
                      ?? 0;
        this.scoreOcrMov = Number(scoreRaw);
        if (this.scoreOcrMov > 0 && this.scoreOcrMov < EditPlanillaMovilidadComponent.LEGIBLE_MIN_SCORE && !enhance) {
          this.mostrarDialogoLegibilidadMov();
          return;
        }

        // Si fue movilidad ya cambió el mensaje a "Recibo de movilidad detectado…"
        // Solo escribimos el mensaje genérico si seguía vacío.
        if (!this.mensajeOcrMov || this.mensajeOcrMov.startsWith('Procesando') || this.mensajeOcrMov.startsWith('Mejorando')) {
          this.mensajeOcrMov = '✔ Datos extraídos del comprobante.';
        }

        // Tras OCR exitoso, validar duplicado con los datos auto-llenados
        this.validarDuplicadoMov();
      },
      error: (err) => {
        this.cargandoOcrMov = false;
        console.error('[planilla-movilidad] OCR error:', err);
        // En móvil NO hay DevTools — el detalle completo del error debe
        // verse en pantalla para diagnosticar qué falló (status, URL,
        // body del backend, etc.).
        const b = formatHttpError(err, 'OCR /ocr/scan al subir comprobante de movilidad');
        this.mensajeOcrMov = b.summary;
        Swal.fire({
          icon: 'error',
          title: b.title,
          html: errorHtml(b),
          width: 600,
          confirmButtonText: 'Entendido',
        });
      }
    });
  }

  /**
   * Muestra el diálogo de 3 opciones cuando la imagen es poco legible:
   *  - IMPROVE: reintenta OCR con enhance=true (Nivel 3)
   *  - MANUAL: el usuario completa los campos manualmente
   *  - CANCEL: descarta el archivo
   */
  private mostrarDialogoLegibilidadMov(): void {
    const ref = this.dialog.open(LegibilityChoiceDialogComponent, {
      width: '380px',
      disableClose: true,
      data: { score: this.scoreOcrMov }
    });
    ref.afterClosed().subscribe((choice: LegibilityChoice) => {
      switch (choice) {
        case 'IMPROVE':
          this.procesarOcrMov(true);
          break;
        case 'MANUAL':
          this.mensajeOcrMov = '⚠ Imagen poco legible — complete los campos manualmente.';
          break;
        case 'CANCEL':
        default:
          this.onDescartarImagenMov();
          break;
      }
    });
  }

  /**
   * Valida si el comprobante actual (Auxiliar + Tipo + Serie + Número) ya fue
   * registrado en otra Orden de Pago. Si es duplicado, advierte al usuario
   * y bloquea el guardado mediante `esDuplicadoMov`.
   *
   * Se invoca:
   *   - Tras OCR exitoso (auto)
   *   - Al cambiar manualmente Tipo, Serie o Número
   */
  validarDuplicadoMov(): void {
    const cod = (this.nuevoDetalle.codDocumento || '').trim();
    const num = (this.nuevoDetalle.numDocumento || '').trim();

    // En movilidad NO usamos Serie ni Auxiliar (proveedor) — la clave
    // de duplicado es Tipo + Número del comprobante únicamente.
    if (!cod || !num) {
      this.esDuplicadoMov = false;
      this.mensajeDuplicadoMov = '';
      return;
    }

    const wrapper: WrapperRequestDocumebtoExistente = new WrapperRequestDocumebtoExistente();
    wrapper.codAuxiliar = '';
    wrapper.codDocumento = cod;
    wrapper.codEmpresa = this.orden?.codEmpresa;
    wrapper.codSucursal = this.orden?.codSucursal;
    // ❗ NO enviar numOrden — el SQL del backend no lo espera
    // (expecting one of [codDocumento, numDocumento, codAuxiliar, codEmpresa, numSerieDoc, codSucursal])
    // Si lo seteamos, Hibernate intenta bindearlo y truena con error=2.
    wrapper.numDocumento = num;
    wrapper.numSerieDoc = '';

    this.ordenPagoDetService.onBuscarDocumento(wrapper).subscribe({
      next: (response: Response) => {
        if (response.error === 1) {
          this.esDuplicadoMov = true;
          this.mensajeDuplicadoMov =
            `El comprobante ${num} ya fue registrado en otra Orden de Pago. ` +
            `No se permite duplicar.`;
          Swal.fire({
            icon: 'error',
            title: 'Comprobante duplicado',
            text: this.mensajeDuplicadoMov,
            confirmButtonText: 'Entendido'
          });
        } else {
          this.esDuplicadoMov = false;
          this.mensajeDuplicadoMov = '';
        }
      },
      error: (err) => {
        console.warn('[planilla-movilidad] error validando duplicado:', err);
        this.esDuplicadoMov = false;
        this.mensajeDuplicadoMov = '';
      }
    });
  }

  /**
   * Sube el archivo del comprobante al backend (regina-process-dev).
   * Se invoca SOLO después de que `saveDetails()` haya creado el detalle
   * correctamente, así sabemos el `numItem` real para asociar al archivo.
   *
   * Reutiliza el mismo endpoint que rendir-cuenta (`documentos/upload`)
   * para que el archivo se vea con el mismo viewer al editar.
   */
  subirArchivoDetalleMov(numItem: number | string): void {
    if (!this.selectedFileMov) return;

    const fecha = new Date(this.nuevoDetalleFecha || new Date());
    const anio = fecha.getFullYear().toString().padStart(4, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');

    const ext = this.selectedFileMov.name.split('.').pop()?.toLowerCase() || '';

    const wrapper: WrapperUploadDocumento = new WrapperUploadDocumento();
    wrapper.file = this.selectedFileMov;
    wrapper.codEmpresa = this.orden?.codEmpresa;
    wrapper.codSucursal = this.orden?.codSucursal;
    wrapper.anioPeriodo = anio;
    wrapper.mesPeriodo = mes;
    wrapper.tipoDocumento = this.nuevoDetalle.codDocumento || '';
    wrapper.numOrden = this.orden?.numOrden?.toString() || '';
    wrapper.numItem = numItem.toString();
    wrapper.extension = ext;

    this.documentoService.uploadFile(wrapper).subscribe({
      next: (resp) => console.log('[planilla-movilidad] archivo subido', resp),
      error: (err) => {
        console.error('[planilla-movilidad] error subiendo archivo', err);
        // Muestra el error real del backend (no un mensaje genérico).
        // Útil cuando el backend falla por nombre de archivo inseguro,
        // permisos de carpeta, o tamaño máximo excedido.
        const b = formatHttpError(err, 'Guardado de archivo de movilidad en servidor');
        Swal.fire({
          icon: 'warning',
          title: 'Detalle guardado, archivo no subido',
          html: errorHtml(b),
          width: 600,
          confirmButtonText: 'Entendido',
        });
      }
    });
  }

  /**
   * Mapea los campos extraídos por el OCR al objeto `nuevoDetalle` de la
   * planilla de movilidad. Convierte fechas, importes y normaliza número
   * de documento al mismo formato que el modal espera.
   *
   * Si el OCR detectó que es un recibo de movilidad (`isMobility: true`),
   * también rellena dirOrigen / dirDestino con Pick-up / Drop-off, y la
   * glosa con la sugerencia generada por el extractor.
   */
  private mapDetectedToDetalleMov(detected: any): void {
    // Fecha del documento → fecha del traslado
    if (detected.documentDate) {
      this.nuevoDetalleFecha = detected.documentDate;
    }

    // Tipo de documento
    //
    // Estrategia:
    //   1) Si el OCR detectó MOVILIDAD (isMobility=true), priorizamos buscar
    //      en el catálogo un documento cuya descripción contenga palabras
    //      clave de transporte: BOLETO TRANSPORTE / BOLETO DE TRANSPORTE /
    //      MOVILIDAD / TAXI / BOLETO. Si no, caemos al código BT.
    //   2) Si NO es movilidad, hacemos el match exacto por código
    //      (BT, FC, BV…) y como fallback por letra inicial.
    if (detected.documentType) {
      const tipoRaw = String(detected.documentType).trim().toUpperCase();
      let elegido: MaeDocumento | undefined;

      if (detected.isMobility) {
        elegido = this.buscarDocumentoMovilidad();
      }

      if (!elegido) {
        elegido = (this.documentosGeneral || [])
          .find((d: any) => d.codDocumento?.toString().toUpperCase() === tipoRaw);
      }

      if (!elegido) {
        // Búsqueda por letra inicial (último recurso)
        const letra = tipoRaw.substring(0, 1);
        const candidatos = (this.documentosGeneral || [])
          .filter((d: any) => d.codDocumento?.toString().toUpperCase().startsWith(letra));
        if (candidatos.length > 0) {
          const dosLetras = candidatos.find((d: any) => (d.codDocumento || '').length >= 2);
          elegido = dosLetras || candidatos[0];
        }
      }

      if (elegido) {
        this.nuevoDetalle.codDocumento = elegido.codDocumento;
      }
    }

    // Número de documento: el modal de planilla movilidad ya no separa
    // Serie y Número. Guardamos el invoice/folio completo en numDocumento.
    if (detected.documentNumber) {
      this.nuevoDetalle.numDocumento = String(detected.documentNumber).trim();
    }

    // Importe total
    const importe = Number(detected.amount);
    if (Number.isFinite(importe) && importe > 0) {
      this.nuevoDetalle.importe = importe;
    }

    // ─── Rama específica de movilidad ──────────────────────────────
    if (detected.isMobility) {
      // Pick-up / Drop-off → direcciones de origen y destino
      if (detected.pickupAddress) {
        this.nuevoDetalle.dirOrigen = String(detected.pickupAddress).substring(0, 200);
      }
      if (detected.dropoffAddress) {
        this.nuevoDetalle.dirDestino = String(detected.dropoffAddress).substring(0, 200);
      }
      // Glosa sugerida (servicio · chofer · vehículo)
      if (detected.glosaSugerida && !this.nuevoDetalle.glosa) {
        this.nuevoDetalle.glosa = String(detected.glosaSugerida).substring(0, 200);
      }
      // Hint visual de que es movilidad
      this.mensajeOcrMov = '✔ Recibo de movilidad detectado — Origen/Destino y glosa pre-rellenados.';
      return;
    }

    // ─── Comprobante normal: glosa desde items ─────────────────────
    if (detected.items && Array.isArray(detected.items) && detected.items.length > 0) {
      const descripciones = detected.items
        .map((it: any) => it.descripcion || it.Descripción || it.Descripcion || '')
        .filter((s: string) => !!s);
      if (descripciones.length > 0 && !this.nuevoDetalle.glosa) {
        this.nuevoDetalle.glosa = descripciones.slice(0, 2).join(' / ').substring(0, 200);
      }
    }
  }

  /**
   * Aplica mejora de imagen (Nivel 3) y reprocesa OCR. Se invoca desde
   * un botón secundario en el modal.
   */
  /**
   * Busca en el catálogo `documentosGeneral` el documento más apropiado
   * para un recibo de movilidad. Devuelve el primer match por:
   *   1. Código BT, BA, BTV o BIA exacto (códigos SUNAT de transporte)
   *   2. Descripción que contenga BOLETO + TRANSPORTE
   *   3. Descripción que contenga MOVILIDAD
   *   4. Descripción que contenga TAXI / UBER / TRANSPORTE
   *   5. Descripción que contenga BOLETO (cualquier boleto)
   *
   * Si nada encaja, retorna undefined y el caller usa el fallback general.
   * Cuando esto pase, se imprime la lista completa de documentos en consola
   * para que el desarrollador pueda añadir explícitamente el código correcto.
   */
  private buscarDocumentoMovilidad(): MaeDocumento | undefined {
    const docs = this.documentosGeneral || [];
    if (!docs.length) return undefined;

    const normalize = (s: any): string =>
      (s || '').toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

    // 1) Códigos SUNAT exactos de transporte (en orden de preferencia)
    const codigosMovilidad = ['BT', 'BTP', 'BTV', 'BIA', 'BA'];
    for (const cod of codigosMovilidad) {
      const m = docs.find((d: any) => normalize(d.codDocumento) === cod);
      if (m) {
        console.log(`[planilla-movilidad] Tipo movilidad por código exacto: ${cod} = ${m.desDocumento}`);
        return m;
      }
    }

    // 2) Descripción con BOLETO + TRANSPORTE
    let m = docs.find((d: any) => {
      const desc = normalize(d.desDocumento);
      return desc.includes('BOLETO') && desc.includes('TRANSPORTE');
    });
    if (m) { console.log(`[planilla-movilidad] Match BOLETO+TRANSPORTE: ${m.codDocumento}=${m.desDocumento}`); return m; }

    // 3) Descripción con MOVILIDAD
    m = docs.find((d: any) => normalize(d.desDocumento).includes('MOVILIDAD'));
    if (m) { console.log(`[planilla-movilidad] Match MOVILIDAD: ${m.codDocumento}=${m.desDocumento}`); return m; }

    // 4) Descripción con TAXI o TRANSPORTE
    m = docs.find((d: any) => {
      const desc = normalize(d.desDocumento);
      return desc.includes('TAXI') || desc.includes('TRANSPORTE');
    });
    if (m) { console.log(`[planilla-movilidad] Match TAXI/TRANSPORTE: ${m.codDocumento}=${m.desDocumento}`); return m; }

    // 5) Cualquier BOLETO (excluyendo BOLETA — los recibos de inDrive son
    //    boletos, no boletas de venta)
    m = docs.find((d: any) => {
      const desc = normalize(d.desDocumento);
      return desc.includes('BOLETO') && !desc.includes('BOLETA');
    });
    if (m) { console.log(`[planilla-movilidad] Match BOLETO: ${m.codDocumento}=${m.desDocumento}`); return m; }

    // Sin match: imprimimos los códigos disponibles en gran formato para
    // que el desarrollador identifique cuál añadir explícitamente.
    console.group('%c[planilla-movilidad] ⚠ Ningún tipo de documento encaja con MOVILIDAD',
                  'color:#dc3545;font-weight:bold;font-size:13px;');
    console.warn('Códigos disponibles en su catálogo (codDocumento = desDocumento):');
    docs.forEach((d: any) => {
      console.log(`   ${d.codDocumento?.padEnd(8) || '(vacío)'}  =  ${d.desDocumento || '(sin desc)'}`);
    });
    console.warn('Avíseme el código que su empresa usa para movilidad y lo agrego al algoritmo.');
    console.groupEnd();
    return undefined;
  }

  mejorarImagenMov(): void {
    this.procesarOcrMov(true);
  }

  /**
   * Abre la imagen del comprobante en pantalla completa nativa del
   * navegador. Útil en móvil para inspeccionar el documento completo con
   * pinch-zoom. Click en cualquier parte o ESC cierra el modo fullscreen.
   */
  abrirPantallaCompletaMov(event: MouseEvent): void {
    const img = event.target as HTMLElement;
    if (!img) return;
    const el = img as any;
    const req: any =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;
    if (req) {
      try { req.call(el); } catch { /* el navegador puede bloquear sin gesto */ }
    }
  }

  /**
   * Limpia el archivo cargado y el preview. Se invoca con el botón
   * "Eliminar" o automáticamente al cerrar el modal de detalle.
   */
  onDescartarImagenMov(): void {
    this.selectedFileMov = null;
    this.previewImageMov = null;
    this.pdfPreviewUrlMov = null;
    this.pdfPreviewRawUrlMov = null;
    this.showPdfPreviewMov = false;
    this.cargandoOcrMov = false;
    this.mensajeOcrMov = '';
  }

  openAuxiliaresModal(): void {
    this.currentPageAux = 0;
    this.buildPaginationAuxiliares();
    const modalElement = document.getElementById('modalAuxiliares');
    if (modalElement) {
      this.modalAuxiliares = new bootstrap.Modal(modalElement);
      this.modalAuxiliares.show();
    }
  }

  closeAuxiliaresModal(): void {
    this.modalAuxiliares?.hide();
  }

  selectAuxiliar(auxiliar: MaeAuxiliarDTO): void {
    this.auxiliarSeleccionado = auxiliar;
    this.nuevoDetalle.codAuxiliarProveedor = auxiliar.codAuxiliar ?? '';
    this.closeAuxiliaresModal();
  }

  openUsuariosModal(): void {
    this.currentPageUsers = 0;
    this.searchUsuarios = '';   // reset del buscador al abrir
    this.buildPaginationUsuarios();
    const modalElement = document.getElementById('modalUsuarios');
    if (modalElement) {
      this.modalUsuarios = new bootstrap.Modal(modalElement);
      this.modalUsuarios.show();
    }
  }

  closeUsuariosModal(): void {
    this.modalUsuarios?.hide();
  }

  isOcupanteSelected(user: RegSecUser): boolean {
    const key = this.getUserKey(user);
    return this.ocupantesSeleccionados.some(x => this.getUserKey(x) === key);
  }

  toggleOcupante(user: RegSecUser): void {
    const key = this.getUserKey(user);
    const index = this.ocupantesSeleccionados.findIndex(x => this.getUserKey(x) === key);
    if (index >= 0) {
      this.ocupantesSeleccionados.splice(index, 1);
      this.syncOcupantes();
      return;
    }
    this.ocupantesSeleccionados.push(user);
    this.syncOcupantes();
  }

  private syncOcupantes(): void {
    const nombres = this.ocupantesSeleccionados
      .map(x => this.getUserDisplayName(x))
      .filter(nombre => !!nombre);
    this.nuevoDetalle.ocupantes = nombres.length > 0 ? JSON.stringify(nombres) : '';
  }

  private parseOcupantes(value: string | undefined | null): string[] {
    if (!value) return [];
    const raw = value.trim();
    if (!raw) return [];
    if (/^\d+$/.test(raw)) return [];

    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map(x => String(x).trim()).filter(x => !!x);
    } catch {
      return raw
        .split(',')
        .map(x => x.trim())
        .filter(x => !!x);
    }
  }

  getOcupantesCount(value: string | undefined | null): number {
    const list = this.parseOcupantes(value);
    if (list.length > 0) return list.length;
    const raw = (value ?? '').trim();
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }

  get ocupantesTexto(): string {
    return this.ocupantesSeleccionados
      .map(x => this.getUserDisplayName(x))
      .filter(nombre => !!nombre)
      .join(', ');
  }

  private resetOcupantes(): void {
    this.ocupantesSeleccionados = [];
    this.nuevoDetalle.ocupantes = '';
  }

  private getUserKey(user: RegSecUser): string {
    return String(user.userId ?? user.userUsername ?? user.userEmail ?? user.userName ?? '');
  }

  getUserDisplayName(user: RegSecUser): string {
    const fullName = [user.userLastName, user.userMiddleName, user.userName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || user.userUsername || user.userEmail || `Usuario ${user.userId ?? ''}`.trim();
  }

  openUbigeosModal(tipoUbigeo: number): void {
    this.tipoUbigeo = tipoUbigeo;
    const modalElement = document.getElementById('modalUbigeos');
    if (modalElement) {
      this.modalUbigeos = new bootstrap.Modal(modalElement);
      this.modalUbigeos.show();
    }
  }

  closeUbigeosModal(): void {
    this.modalUbigeos?.hide();
  }

  openOcupantesModal(value: string | undefined | null): void {
    const nombres = this.parseOcupantes(value);
    const raw = (value ?? '').trim();
    this.ocupantesModalNombres = nombres.length > 0 ? nombres : (raw ? [raw] : []);

    const modalElement = document.getElementById('modalOcupantes');
    if (modalElement) {
      this.modalOcupantes = new bootstrap.Modal(modalElement);
      this.modalOcupantes.show();
    }
  }

  closeOcupantesModal(): void {
    this.modalOcupantes?.hide();
    this.ocupantesModalNombres = [];
  }

  saveDetails(): void {
    if (this.guardandoDetalle || !this.nuevoDetalleFecha) return;

    const codPlanilla = this.ordenPagoPlanillaMovilidadCab.codPlanilla ?? '';
    const commonSwalConfig: any = {
      toast: true, position: 'top-end', showConfirmButton: false,
      timer: 3000, timerProgressBar: true
    };

    if (!codPlanilla) {
      Swal.fire({
        ...commonSwalConfig,
        icon: 'warning',
        title: 'Debe guardar la planilla antes de agregar detalles.'
      });
      return;
    }

    const importeNuevo = Number(this.nuevoDetalle.importe ?? 0);
    const totalCabecera = Number(this.ordenPagoPlanillaMovilidadCab.total ?? 0);
    const totalActual = this.getTotalImporteDetalles();

    if (totalCabecera > 0 && (totalActual + importeNuevo) > totalCabecera) {
      Swal.fire({
        ...commonSwalConfig,
        icon: 'warning',
        title: 'La suma de los importes supera el total permitido en la cabecera.'
      });
      return;
    }

    const maxViajes = Number(this.ordenPagoPlanillaMovilidadCab.maxNumViajes ?? 0);
    if (maxViajes > 0 && (this.listaMovilidad.length + 1) > maxViajes) {
      Swal.fire({
        ...commonSwalConfig,
        icon: 'warning',
        title: 'Has alcanzado el número máximo de viajes permitido en la cabecera.'
      });
      return;
    }

    this.loadingService.show();
    this.guardandoDetalle = true;

    const commonParams = this.getOrderParams();
    const detalleInsertado: OrdenPagoPlanillaMovilidadDet = {
      ...this.nuevoDetalle,
      ...commonParams,
      codPlanilla,
      fecItemPlanilla: new Date(this.nuevoDetalleFecha)
    };

    this.planillaDetService.insertarDetalle(detalleInsertado)
      .pipe(finalize(() => this.finalizeSave()))
      .subscribe({
        next: (response: any) => {
          if (response?.error === 0) {
            detalleInsertado.numItemPlanilla = response.resultado;
            this.listaMovilidad = [detalleInsertado, ...this.listaMovilidad];
            this.currentPage = 0;
            this.buildPagination();

            // Si el usuario subió el comprobante, lo asociamos al numItem
            // recién generado. Esto se hace en background; no bloquea la UX.
            if (this.selectedFileMov) {
              this.subirArchivoDetalleMov(response.resultado);
            }

            this.closeDetailModal();
            Swal.fire({
              ...commonSwalConfig,
              icon: 'success',
              title: '¡Registro Exitoso!',
              text: 'El detalle de la planilla ha sido guardado correctamente.',
            });
          } else {
            Swal.fire({
              ...commonSwalConfig,
              icon: 'error',
              title: response?.mensaje || 'No se pudo insertar el detalle.'
            });
          }
        },
        error: () => {
          Swal.fire({
            ...commonSwalConfig,
            icon: 'error',
            title: 'No se pudo insertar el detalle.'
          });
        }
      });
  }

  savePlanilla(): void {
    if (this.guardandoCabecera || !this.modelPlanillaIni) return;

    // ====== VALIDACIÓN: importe máximo por día (regla configurable) ======
    const maxNum   = Number(this.ordenPagoPlanillaMovilidadCab.maxNumViajes ?? 0);
    const total    = Number(this.ordenPagoPlanillaMovilidadCab.total ?? 0);
    const maxPlan  = maxNum > 0 ? maxNum * this.importeMaxDia : this.importeMaxDia;

    if (total > maxPlan + 0.001) {
      // Usar el mensaje definido en la regla REG_REN_VALIDATE si existe;
      // si no, generar uno genérico con los valores calculados.
      const detalle = `Ingresado: <strong>S/ ${total.toFixed(2)}</strong> · ` +
                      `Permitido: <strong>S/ ${maxPlan.toFixed(2)}</strong> ` +
                      `(S/ ${this.importeMaxDia.toFixed(2)}/día` +
                      `${maxNum > 0 ? ` × ${maxNum} día(s)` : ''})`;

      const mensajeRegla = (this.importeMaxDiaErrorMsg || '').trim();
      const htmlBody = mensajeRegla
        ? `${mensajeRegla}<br><br><span style="color:#666;font-size:0.9em;">${detalle}</span>`
        : `El importe ingresado <strong>S/ ${total.toFixed(2)}</strong> supera el ` +
          `máximo permitido <strong>S/ ${maxPlan.toFixed(2)}</strong> ` +
          `(S/ ${this.importeMaxDia.toFixed(2)} por día${maxNum > 0 ? ` × ${maxNum} día(s)` : ''}).<br><br>` +
          `Ajuste el importe máximo de la planilla.`;

      Swal.fire({
        title: 'Importe excede el tope permitido',
        html: htmlBody,
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    this.loadingService.show();
    this.guardandoCabecera = true;

    const currentCodPlanilla = this.ordenPagoPlanillaMovilidadCab.codPlanilla;

    const dto: OrdenPagoCabPlanilla = {
      ...this.getOrderParams(),
      codPlanilla: currentCodPlanilla,
      fechaPlanilla: moment(this.modelPlanillaIni).toDate(),
      maxNumViajes: this.ordenPagoPlanillaMovilidadCab.maxNumViajes,
      total: this.ordenPagoPlanillaMovilidadCab.total,
      glosa: this.ordenPagoPlanillaMovilidadCab.glosa,
      codAuxiliarBanco: '',
      codAuxiliarPersonal: '',
      cCentroCostos: '',
      monto: 0,
      recibido: 0,
      devolucion: 0,
      statusPlanilla: 'PE'
    };

    const request$ = currentCodPlanilla
      ? this.planillaCabService.updatePlanillaMovilidad(dto)
      : this.planillaCabService.savePlanillaMovilidad(dto);

    request$
      .pipe(finalize(() => this.finalizeSave()))
      .subscribe({
        next: (response) => {
          if (response?.error !== 0) {
            console.error("Error en servidor:", response?.mensaje);
          }
          if (!currentCodPlanilla && response.resultado) {
            this.ordenPagoPlanillaMovilidadCab.codPlanilla = response.resultado;
          }
        },
        error: (err) => console.error("Error de conexión:", err)
      });
  }

  private finalizeSave(): void {
    this.loadingService.hide();
    this.guardandoCabecera = false;
    this.guardandoDetalle = false;
  }

  private getTotalImporteDetalles(): number {
    return this.listaMovilidad.reduce((sum, d) => sum + Number(d.importe ?? 0), 0);
  }

  isGuardarDisabled(): boolean {
    return !this.modelPlanillaIni
      || !this.ordenPagoPlanillaMovilidadCab.total
      || !this.ordenPagoPlanillaMovilidadCab.maxNumViajes
      || !this.ordenPagoPlanillaMovilidadCab.glosa;
  }

  isFormInvalid(): boolean {
    // 🔒 Si se detectó duplicado, no se permite guardar
    if (this.esDuplicadoMov) {
      return true;
    }
    // En planilla de movilidad ya no se piden Serie ni Proveedor
    // (los recibos de apps de movilidad como inDrive/Uber no los manejan).
    return (
      !this.nuevoDetalleFecha ||
      !this.nuevoDetalle.codDocumento ||
      !this.nuevoDetalle.numDocumento?.trim() ||
      !this.nuevoDetalle.glosa?.trim() ||
      !this.nuevoDetalle.importe || this.nuevoDetalle.importe <= 0 ||
      !this.nuevoDetalle.ocupantes ||
      !this.nuevoDetalle.codOrigen ||
      !this.nuevoDetalle.codDestino
    );
  }
}
