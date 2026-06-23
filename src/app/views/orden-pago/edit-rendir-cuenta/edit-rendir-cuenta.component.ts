import { CommonModule, Location } from '@angular/common';
import { Component, ElementRef, NO_ERRORS_SCHEMA, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NgbDatepickerConfig, NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import Tesseract from 'tesseract.js';
import { OrdenPago } from '../../../models/orden-pago';
import { OcrService } from '../../../services/ocr.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { Observable } from 'rxjs';
import { SunatService } from '../../../services/sunat-service';
import { Router } from '@angular/router';
import { PadronRuc } from '../../../models/padron-ruc';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { RegRenKeywordService } from '../../../services/reg-ren-keyword.service';
import { RegRenValidate } from '../../../models/reg-ren-validate';
import { RegRenKeywordDTO } from '../../../models/reg-ren-keyword-dto';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { LegibilityChoiceDialogComponent, LegibilityChoice } from '../../../components/dialogs/legibility-choice-dialog.component';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ValidationEngineService } from '../../../shared/services/validation-engine.service';
import { ValidationContext } from '../../../shared/models/validation-context';
import Swal from 'sweetalert2';
import {
  RucInput,
  DocumentType,
  DocumentSection,
  FieldCode,
} from '../../../shared/constants/validation-constants';
import { MaestrosService } from '../../../services/maestros.service';
import { SunatAnexosService } from '../../../services/sunat-anexos.service';
import { EstablecimientoAnexo, RucAnexosResponse } from '../../../models/establecimiento-anexo';
import { AnexoSelectorDialogComponent, AnexoSelectorData } from '../../../components/dialogs/anexo-selector-dialog.component';
import { Response } from '../../../models/response';
import { MaeRubro } from '../../../models/mae-rubro';
import { OrdenPagoDetDTO } from '../../../models/orden-pago-det';
import { MaeTipoGasto } from '../../../models/mae-tipo-gasto';
import { MaeDocumento } from '../../../models/mae-documento';
import { MaeMoneda } from '../../../models/mae-moneda';
import { MaeImpuesto } from '../../../models/mae-impuesto';
import { OrdenPagoDetProv } from '../../../models/orden-pago-det-prov';
import { DeviceService } from '../../../services/core-service/device.service';
import { DocumentoService } from '../../../services/documento.service';
import { OrdenPagoDetService } from '../../../services/orden-pago-det.service';
import { MaeAuxiliarDTO } from '../../../models/mae-auxiliar-dto';
import { WrapperUploadDocumento } from '../../../models/wrappers/wrapper-upload-documento';
import { ConfigService } from '../../../services/config.service';
import { OrdenPagoDetProvService } from '../../../services/orden-pago-det-prov.service';
import { WrapperRequestDocumebtoExistente } from '../../../models/wrappers/wrapper-request-documento-existente';
import { NgxCurrencyDirective } from 'ngx-currency';
import { WrapperComprobanteSunat } from '../../../models/wrappers/WrapperComprobanteSunat';
import { RegSunResponseComprobanteSunat } from '../../../models/reg-sun-response-comprobante-sunat';
export class ItemDetalle {
  descripcion?: string;
}
export class DatosImagen {
  documentType?: string;
  documentNumber?: string;
  documentCurrency?: string;
  issuerRuc: string[] = [];
  issuerName?: string;
  issuerAddress?: string;
  documentDate?: string;
  amount?: string = '0.00';
  items: ItemDetalle[] = [];
  currency?: string;
  rawText?: string;
  igv?: string = '0.00';

}

@Component({
  selector: 'app-edit-rendir-cuenta',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbDatepickerModule,
    ImageCropperComponent,
    LoadingDancingSquaresComponent,
    NgxCurrencyDirective
  ],
  templateUrl: './edit-rendir-cuenta.component.html',
  styleUrls: ['./edit-rendir-cuenta.component.scss'], // ✅ corregido
  schemas: [NO_ERRORS_SCHEMA]
})
export class EditRendirCuentaComponent implements OnInit {
  @ViewChild('orderDialog') orderDialog!: TemplateRef<any>;
  dialogRef!: MatDialogRef<any>;

  constructor(
    private location: Location,
    private ocrService: OcrService,
    private loadingService: LoadingService,
    private sunatService: SunatService,
    private router: Router,
    private dialog: MatDialog,
    private regRenValidateService: RegRenValidateService,
    private regRenKeywordService: RegRenKeywordService,
    private validationEngine: ValidationEngineService,
    private maestrosService: MaestrosService,
    private deviceService: DeviceService,
    private documentoService: DocumentoService,
    private ordenPagoDetService: OrdenPagoDetService,
    private ordenPagoDetProvService: OrdenPagoDetProvService,
    private configService: ConfigService,
    private config: NgbDatepickerConfig,
    private sanitizer: DomSanitizer,
    private sunatAnexosService: SunatAnexosService
  ) {
    this.isLoading$ = this.loadingService.loading$;
    this.config.navigation = 'select';
  }

  // ─── Estado de Establecimientos Anexos del proveedor ───────────────────
  /** Lista de anexos disponibles del RUC consultado. */
  anexosDisponibles: EstablecimientoAnexo[] = [];
  /** Anexo elegido por el usuario en el modal (obligatorio para guardar). */
  anexoSeleccionado: EstablecimientoAnexo | null = null;
  /** Bandera de "consultando SUNAT" para deshabilitar el botón mientras carga. */
  cargandoAnexos: boolean = false;
  /** Último RUC para el cual se cargaron anexos (evita recargar el mismo). */
  private _ultRucAnexos: string = '';

  codEmpresa: string = sessionStorage.getItem('codempresa') || '';
  codAuxiliar: string = '';
  auxiliarProveedor: MaeAuxiliarDTO = new MaeAuxiliarDTO();
  listaAuxiliares: MaeAuxiliarDTO[] = [];
  orden: OrdenPago = new OrdenPago();
  dataImagen: DatosImagen = new DatosImagen();
  imageChangedEvent: Event | null = null;
  previewImage: string | null = null;
  croppedImage: string | null = null;
  pdfPreviewUrl: SafeResourceUrl | null = null;
  private pdfObjectUrl: string | null = null;
  showImageCropper = true;
  showPdfPreview = false;
  recognizedText = '';
  isLoading$: Observable<boolean>;
  detalle: string = '';
  ruc: string = "";
  validate: boolean = false;
  hasValidRules: boolean = false;
  hasValidItems: boolean = true;
  mensaje: string = "";
  mensajeDetalle: string = "";
  padronRuc: PadronRuc = new PadronRuc();
  validaComprobante: boolean = false;
  wrapper: WrapperComprobanteSunat = new WrapperComprobanteSunat();
  /**
   * Nombre a mostrar en el campo "Proveedor".
   * Prioriza el nombre comercial; si no viene, cae a la razón social.
   * Si ninguno está disponible, devuelve cadena vacía.
   */
  get nombreProveedor(): string {
    const nc = (this.padronRuc?.nombreComercial || '').trim();
    if (nc) return nc;
    return (this.padronRuc?.razonSocial || '').trim();
  }

  /**
   * Tooltip del campo "Proveedor" — muestra la razón social completa,
   * útil cuando se está mostrando el nombre comercial en el input visible.
   * Se expone como getter para evitar problemas de strict template type-check
   * con `padronRuc?.razonSocial || ''` directamente en el HTML.
   */
  get tituloProveedor(): string {
    return (this.padronRuc?.razonSocial || '').trim();
  }

  /**
   * Tooltip del badge "(nombre comercial)" — siempre devuelve string.
   * Evita la concatenación `'Razón Social: ' + padronRuc.razonSocial`
   * que el strict template type-check marca cuando razonSocial es undefined.
   */
  get tituloBadgeComercial(): string {
    const rs = (this.padronRuc?.razonSocial || '').trim();
    return rs ? `Razón Social: ${rs}` : '';
  }

  /**
   * ¿Mostrar el badge "(nombre comercial)" al lado del label Proveedor?
   * Solo se muestra si hay AMBOS y son distintos — para no decirle al usuario
   * "esto es el nombre comercial" cuando en realidad es la razón social.
   */
  get mostrarBadgeComercial(): boolean {
    const nc = (this.padronRuc?.nombreComercial || '').trim();
    const rs = (this.padronRuc?.razonSocial || '').trim();
    return !!nc && !!rs && nc !== rs;
  }

  /**
   * Abre un Swal mostrando la razón social registrada en SUNAT
   * con el texto SELECCIONABLE y un botón para copiar al portapapeles.
   * Útil cuando el campo "Proveedor" está mostrando el nombre comercial
   * y el usuario quiere ver/copiar la razón social completa.
   */
  mostrarRazonSocial(): void {
    const rs = (this.padronRuc?.razonSocial || '').trim();
    const nc = (this.padronRuc?.nombreComercial || '').trim();

    if (!rs && !nc) {
      Swal.fire({
        icon: 'info',
        title: 'Sin información',
        text: 'Aún no se ha consultado el proveedor en SUNAT.',
        confirmButtonText: 'Cerrar'
      });
      return;
    }

    const html = `
      <div style="text-align:left; font-family: var(--app-font-family, Arial);">
        <div style="margin-bottom:8px;">
          <strong>Razón Social:</strong>
          <div style="user-select:text; padding:6px 8px; border:1px solid #dee2e6;
                      border-radius:4px; margin-top:4px; background:#f8f9fa; word-break:break-word;">
            ${rs || '<em>(no disponible)</em>'}
          </div>
        </div>
        ${nc ? `
        <div>
          <strong>Nombre Comercial:</strong>
          <div style="user-select:text; padding:6px 8px; border:1px solid #dee2e6;
                      border-radius:4px; margin-top:4px; background:#f8f9fa; word-break:break-word;">
            ${nc}
          </div>
        </div>` : ''}
      </div>
    `;

    Swal.fire({
      title: 'Datos del proveedor',
      html,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Copiar razón social',
      cancelButtonText: 'Cerrar',
      focusConfirm: false
    }).then(result => {
      if (result.isConfirmed && rs) {
        const copyFallback = () => {
          try {
            const ta = document.createElement('textarea');
            ta.value = rs;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
          } catch { return false; }
        };

        const showOk = () => Swal.fire({
          icon: 'success', title: 'Copiado', text: 'Razón social copiada al portapapeles.',
          timer: 1500, showConfirmButton: false
        });

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(rs).then(showOk, () => {
            if (copyFallback()) showOk();
          });
        } else if (copyFallback()) {
          showOk();
        }
      }
    });
  }

  reglas: RegRenValidate[] = [];
  keywords: RegRenKeywordDTO[] = [];
  rubros: MaeRubro[] = [];
  tiposGasto: MaeTipoGasto[] = [];
  documentos: MaeDocumento[] = [];
  documentosGeneral: MaeDocumento[] = [];
  documentoSeleccionado: MaeDocumento = new MaeDocumento();
  rubroSeleccionado: MaeRubro = new MaeRubro();
  tipoGastoSeleccionado: MaeTipoGasto = new MaeTipoGasto();
  monedas: MaeMoneda[] = [];
  monedasGeneral: MaeMoneda[] = [];
  impuestos: MaeImpuesto[] = [];
  ordenPagoDet: OrdenPagoDetDTO = new OrdenPagoDetDTO();
  ordenPagoDetProvs: OrdenPagoDetProv[] = [];
  saldoSoles: number = 0;
  saldoDolares: number = 0;
  /**
   * Saldo base de la OP cuando se abre el componente (impSoles - impRendidoSoles).
   * Se usa para recalcular el saldo cada vez que el usuario cambia el importe
   * del documento, sin perder el saldo original ante varios cambios sucesivos.
   */
  private _saldoBaseSoles: number = 0;
  private _saldoBaseDolares: number = 0;
  /** Debounce del recálculo de saldo para evitar parpadeo en cada tecla. */
  private _saldoDebounce: any = null;
  isDesktop: boolean = false;
  items: any[] = [];
  itemsText: string = '';
  nroItemOp: string = "";
  subTotal: number = 0;
  impuesto: number = 0;
  total: number = 0;
  selectedFile?: File;

  /* ====== Nuevos campos (obs. usuario) ====== */

  // Mes / Año de declaración tributaria (obligatorio)
  meses = [
    { v: 1, n: 'Enero' }, { v: 2, n: 'Febrero' }, { v: 3, n: 'Marzo' },
    { v: 4, n: 'Abril' }, { v: 5, n: 'Mayo' }, { v: 6, n: 'Junio' },
    { v: 7, n: 'Julio' }, { v: 8, n: 'Agosto' }, { v: 9, n: 'Setiembre' },
    { v: 10, n: 'Octubre' }, { v: 11, n: 'Noviembre' }, { v: 12, n: 'Diciembre' }
  ];
  mesDeclaracion: number | null = (new Date()).getMonth() + 1;
  anioDeclaracion: number | null = (new Date()).getFullYear();
  aniosDisponibles: number[] = (() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2, y - 3];
  })();

  // % IGV editable (default 18%)
  igvPercent: number = 18;

  // Mensaje de validación del periodo contable (vacío = válido)
  mensajePeriodo: string = '';

  /**
   * Nombre comercial detectado por OCR (logo/branding del documento).
   * Se guarda aquí para preservarlo cuando handleRucResponse() reemplaza
   * por completo `padronRuc` con la respuesta de SUNAT — si SUNAT no trae
   * nombre comercial, restauramos el detectado por OCR.
   */
  private commercialNameOcr: string = '';

  /**
   * Marca el flujo como entrada manual tras un OCR no legible.
   * Cuando es true, las validaciones que dependen del OCR pueden relajarse
   * y la UI puede destacar que el usuario está llenando los campos a mano.
   */
  requireManualEntry: boolean = false;

  /** Ref al <input type="file"> para reabrirlo programáticamente al mejorar la imagen. */
  @ViewChild('fileInputRef') fileInputRef?: ElementRef<HTMLInputElement>;

  codRubroDefault?: string = "";
  codTipoGastoDefault?: string = "";

  codRubroMovilidad?: string = "";
  codTipoGastoMovilidad?: string = "";
  codDocumentoGeneral: string = "";
  lstDivGastos: string = "";
  arrGastos: string[] = [];
  indMovilidad?: string = "N";
  newDate: Date = new Date();
  modelIni: NgbDateStruct = { year: this.newDate.getFullYear(), month: this.newDate.getMonth() + 1, day: this.newDate.getDate() };

  async ngOnInit() {
    this.loadingService.show();
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data.orden;
      this.indMovilidad = state.data.movilidad;
      await this.configService.loadConfig();
      this.codDocumentoGeneral = this.configService.get('COD_DOCUMENTO_GENERAL');
      this.lstDivGastos = this.configService.get('LST_DIVISION_GASTO');
      this.arrGastos = this.lstDivGastos.replace(/'/g, '').split(',');
      if (this.indMovilidad == 'S') {
        this.codRubroMovilidad = this.configService.get('COD_RUBRO_MOVILIDAD');
        this.codTipoGastoMovilidad = this.configService.get('COD_TIPO_GASTO_MOVILIDAD');
      } else {
        this.codRubroDefault = this.configService.get('COD_RUBRO_GENERAL');
        this.codTipoGastoDefault = this.configService.get('COD_TIPO_GASTO_GENERAL');
      }
      this._saldoBaseSoles = (this.orden.impSoles ?? 0) - (this.orden.impRendidoSoles ?? 0);
      this._saldoBaseDolares = (this.orden.impDolares ?? 0) - (this.orden.impRendidoDolares ?? 0);
      this.saldoSoles = this._saldoBaseSoles;
      this.saldoDolares = this._saldoBaseDolares;
    }
    this.isDesktop = this.deviceService.isDesktopDevice();
    const user = sessionStorage.getItem('user')
      ? JSON.parse(sessionStorage.getItem('user')!)
      : null;
    this.codEmpresa = user?.codEmpresa || '';

    this.ordenPagoDetProvs = [];
    this.loadValidationRules();
    this.loadValidationKeywords();
    this.getRubros();
  }

  inicializa() {
    this._saldoBaseSoles = (this.orden.impSoles ?? 0) - (this.orden.impRendidoSoles ?? 0);
    this._saldoBaseDolares = (this.orden.impDolares ?? 0) - (this.orden.impRendidoDolares ?? 0);
    this.saldoSoles = this._saldoBaseSoles;
    this.saldoDolares = this._saldoBaseDolares;

    this.isDesktop = this.deviceService.isDesktopDevice();
    const user = sessionStorage.getItem('user')
      ? JSON.parse(sessionStorage.getItem('user')!)
      : null;
    this.ordenPagoDetProvs = [];
    this.padronRuc = new PadronRuc();
    this.ruc = "";
    this.dataImagen = new DatosImagen();
    this.imageChangedEvent = null;
    this.previewImage = null;
    this.croppedImage = null;
    this.clearPdfPreview();
    this.showPdfPreview = false;
    this.selectedFile = undefined;
    this.showImageCropper = true;
    this.recognizedText = '';
    this.detalle = '';
    this.ruc = "";
    this.validate = false;
    this.hasValidRules = false;
    this.hasValidItems = true;
    this.mensaje = "";
    this.mensajeDetalle = "";
    this.itemsText = "";
    this.subTotal = 0;
    this.total = 0;
    this.impuesto = 0;

    // 🔁 Reset del estado de validación SUNAT y de la legibilidad de la fecha
    // para que el badge vuelva a "COMPROBANTE NO VALIDADO" y la próxima
    // captura/validación arranque desde cero.
    this.validaComprobante = false;
    this.fechaDocValida = true;
    this.commercialNameOcr = '';

    // Reset del selector de Establecimientos Anexos: al cambiar de
    // proveedor/comprobante, la selección anterior ya no aplica.
    this.anexosDisponibles = [];
    this.anexoSeleccionado = null;
    this._ultRucAnexos = '';

    this.getRubros();
  }

  close() {
    this.dialogRef.close();
  }

  onBack(): void {
    this.location.back();
  }

  loadValidationRules(): void {
    this.regRenValidateService.getRegRenValidateRules().subscribe({
      next: (response: Response) => {
        this.reglas = (response?.resultado ?? []).filter(({ isActive }: RegRenValidate) => isActive);
      },
      error: (error) => {
        console.error('Error al cargar reglas de validación', error);
        this.reglas = [];
      }
    });
  }

  loadValidationKeywords(): void {
    this.regRenKeywordService.getKeywords().subscribe({
      next: (keywords: RegRenKeywordDTO[]) => {
        this.keywords = keywords;
      },
      error: (error) => {
        console.error('Error al cargar palabras clave de validación', error);
        this.keywords = [];
      }
    });
  }

  validateRules(options?: { skipRule?: boolean }): boolean {
    const reglas = options?.skipRule
      ? this.reglas.filter(r => r.fieldCode !== FieldCode.DOCUMENT_TYPE)
      : this.reglas;

    const result = this.validationEngine.validate({
      reglas,
      dataImagen: this.dataImagen,
      padronRuc: this.padronRuc
    });

    this.mensaje = result.errors.join('\n');
    this.hasValidRules = result.isValid;
    this.hasValidState();

    return this.validate;
  }

  onGetDatosRuc(skipRule = false): void {
    this.sunatService.getDataRUC(this.ruc).subscribe({
      next: (response: Response) => {
        this.handleRucResponse(response, skipRule);
        this.codAuxiliar = this.listaAuxiliares.find(aux => aux.numRuc == this.ruc)?.codAuxiliar ?? '';
      },
      error: (err) => this.handleRucError(err)
    });
  }

  async onBuscarDocumento(): Promise<number> {
    let wrapper: WrapperRequestDocumebtoExistente = new WrapperRequestDocumebtoExistente();
    wrapper.codAuxiliar = this.ordenPagoDet.codAuxiliar;
    wrapper.codDocumento = this.ordenPagoDet.codDocumento;
    wrapper.codEmpresa = this.orden.codEmpresa;
    wrapper.codSucursal = this.orden.codSucursal;
    wrapper.numOrden = this.orden.numOrden;

    let serie = '';
    let numero = '';

    if (this.dataImagen.documentNumber) {
      const partes = this.dataImagen.documentNumber.split('-');
      if (partes.length === 2) {
        serie = partes[0];
        numero = partes[1].padStart(15, '0');
      }
    }
    wrapper.numDocumento = numero;
    wrapper.numSerieDoc = serie;

    return new Promise<number>((resolve) => {
      this.ordenPagoDetService.onBuscarDocumento(wrapper).subscribe(
        (response: Response) => {
          if (response.error == 1) {
            resolve(1);
          } else if (response.error == 2) {
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: 'Error',
                message: 'Error al Ingresar Documento',
                type: 'alert'
              }
            });
            resolve(1);
          } else {
            resolve(0);
          }
        },
        (error) => {
          this.dialog.open(ConfirmDialogComponent, {
            width: '280px',
            data: {
              title: 'Error',
              message: 'Error de conexión',
              type: 'alert'
            }
          });
          resolve(1);
        }
      );
    });
  }
  // ..

  getRubros(): void {
    this.maestrosService.getRubros(this.codEmpresa).subscribe(
      (response: Response) => {
        this.rubros = response.resultado || [];
        if (this.indMovilidad !== 'S') {
          if (this.codRubroDefault?.length == 0) {
            this.ordenPagoDet.codRubro = this.rubros.length > 0 ? this.rubros[0].codRubro : '';
          } else {
            this.ordenPagoDet.codRubro = this.codRubroDefault;
          }
        } else {
          this.ordenPagoDet.codRubro = this.codRubroMovilidad;
        }
        this.getTiposGasto(this.ordenPagoDet.codRubro ?? '');
      },
      (error) => {
        console.error('Error al cargar rubros', error);
      }
    );
  }

  getTiposGasto(codRubro: string): void {
    this.maestrosService.getTiposGasto(this.codEmpresa, codRubro).subscribe(
      (response: Response) => {
        this.tiposGasto = response.resultado;
        var filtro: string = "";
        if (this.orden.codCCostos?.startsWith('10')) {
          filtro = "010";
        } else {
          filtro = "0" + this.orden.codCCostos?.substring(0, 1) + this.orden.codCCostos?.substring(2, 3);
        }
        this.tiposGasto = this.tiposGasto.filter(tg => tg.desTipoGasto?.startsWith(filtro));
        /*
        if (this.indMovilidad !== 'S') {
          if (this.codTipoGastoDefault?.length == 0) {
            this.ordenPagoDet.codTipoGasto = this.tiposGasto.length > 0 ? this.tiposGasto[0].codTipoGasto : '';
          } else {
            this.ordenPagoDet.codTipoGasto = this.codTipoGastoDefault;
          }
        } else {
          this.ordenPagoDet.codTipoGasto = this.codTipoGastoMovilidad;
        }
          */
        this.ordenPagoDet.codTipoGasto = this.tiposGasto[0].codTipoGasto;
        this.onChangeTipoGasto();
      },
      (error) => {
        console.error('Error al cargar tipos de gasto', error);
      }
    );
  }

  getTiposDocumento() {
    this.maestrosService.getTiposDocumento(this.codEmpresa).subscribe(
      (response: Response) => {
        // Filtrar SOLO documentos de COMPRA: esta pantalla es de rendición
        // de gastos del titular, por lo que cualquier documento que describa
        // una operación de VENTA debe excluirse del catálogo visible.
        const todos = (response.resultado || []) as MaeDocumento[];
        const filtrados = this.filtrarDocumentosCompra(todos);
        this.documentos = filtrados;
        this.documentosGeneral = filtrados;
        this.documentoSeleccionado = this.documentos[0];
        this.ordenPagoDet.codDocumento = this.documentoSeleccionado?.codDocumento;
        this.codDocumentoGeneral = this.documentoSeleccionado?.codDocumento ?? 'SD';
        this.ordenPagoDet.codCuentaDocumento = this.orden.codMoneda == '01' ? this.documentoSeleccionado?.codCuentaSoles : this.documentoSeleccionado?.codCuentaDolares;
        this.getImpuestos();
      },
      (error) => {
        console.error('Error al cargar tipos de documento', error);
      }
    );
  }

  /**
   * Filtra el catálogo MaeDocumento para mostrar solo los documentos de
   * COMPRA en la pantalla de rendición de gastos. Excluye todos los códigos
   * cuya descripción contenga palabras de venta o exportación.
   *
   * Ejemplos típicos que se excluyen:
   *   - BOLETAS DE VENTAS (BV)
   *   - FACTURA DE VENTA (FV)
   *   - FACTURA DE EXPORTACION VENTA (FX)
   *   - DETRACCION VENTA (VT)
   *   - NOTA DE CREDITO DE VENTA, etc.
   *
   * Reglas:
   *   1. Cualquier documento con la palabra "VENTA"/"VENTAS" se descarta.
   *      EXCEPCIÓN: si también dice "COMPRA" (ej. "BV POR COMPRAS") se
   *      mantiene, porque es claramente de compra a pesar de mencionar
   *      "ventas" en otra parte del texto.
   *   2. Códigos puramente de salida (EXPORTACION, EXP) se descartan.
   *   3. Documentos sin descripción o sin codDocumento también se filtran.
   */
  private filtrarDocumentosCompra(docs: MaeDocumento[]): MaeDocumento[] {
    if (!docs || !docs.length) return [];

    const norm = (s: string | undefined | null): string => {
      if (!s) return '';
      return s.toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
    };

    return docs.filter(d => {
      if (!d?.codDocumento || !d?.desDocumento) return false;
      const desc = norm(d.desDocumento);

      // Excluir: cualquier documento de VENTA o EXPORTACION,
      // pero conservar los que mencionan COMPRA (ej. "BV POR COMPRAS").
      const esVenta = /\b(VENTA|VENTAS|EXPORTACI[OÓ]N|EXPORTACION|EXP\b)/.test(desc);
      const esCompra = /\b(COMPRA|COMPRAS)/.test(desc);

      if (esVenta && !esCompra) {
        return false;
      }
      return true;
    });
  }

  getMonedas() {
    this.maestrosService.getMonedas().subscribe(
      (response: Response) => {
        this.monedas = response.resultado || [];
        this.monedasGeneral = this.monedas;
        this.ordenPagoDet.codMoneda = this.monedas[0].codMoneda ?? '01';
        this.getTiposDocumento();
      },
      (error) => {
        console.error('Error al cargar monedas', error);
      }
    );
  }

  getImpuestos() {
    this.documentoSeleccionado = this.documentosGeneral.find(doc => doc.codDocumento == this.codDocumentoGeneral)!;
    this.maestrosService.getImpuestos(this.codEmpresa, this.codDocumentoGeneral).subscribe(
      (response: Response) => {
        this.impuestos = response.resultado;
        console.log("Impuestos : ", this.impuestos)
        const totalPorcentaje = 1 + ((this.impuestos.reduce((total, impuesto) => total + (impuesto.numPorcentaje || 0), 0)) / 100);
        const tipoCambioStorage = sessionStorage.getItem('tipocambio');
        this.ordenPagoDet.tipCambio = tipoCambioStorage
          ? JSON.parse(tipoCambioStorage).impVenta ?? 1
          : 1;
        if (this.orden.codMoneda == '01') {
          this.ordenPagoDet.impSoles = Number(this.dataImagen.amount) ?? 0;
          this.ordenPagoDet.impDolares = this.ordenPagoDet.impSoles / (this.ordenPagoDet.tipCambio ?? 1);
        } else {
          this.ordenPagoDet.impDolares = Number(this.dataImagen.amount) ?? 0;
          this.ordenPagoDet.impSoles = this.ordenPagoDet.impDolares * (this.ordenPagoDet.tipCambio ?? 1);
        }
        this.ordenPagoDet.impImponSoles = this.ordenPagoDet.impSoles - (this.ordenPagoDet.impSoles / totalPorcentaje);
        this.ordenPagoDet.impImponDolares = this.ordenPagoDet.impDolares - (this.ordenPagoDet.impDolares / totalPorcentaje);
        this.total = Number(this.dataImagen.amount) ?? 0;
        this.subTotal = this.total / totalPorcentaje;
        this.impuesto = this.total - this.subTotal;
        this.onListaAuxiliares();
      },
      (error) => {
        console.error('Error al cargar impuestos', error);
      }
    );
  }

  changeRubro(): void {
    if (this.ordenPagoDet.codRubro) {
      this.getTiposGasto(this.ordenPagoDet.codRubro);
    }
  }

  changeDocumento() {
    this.documentoSeleccionado = this.documentos.find(doc => doc.codDocumento == this.codDocumentoGeneral)!;
    if (this.codDocumentoGeneral == 'SD') {
      this.ordenPagoDet.codCuentaDocumento = this.orden.codMoneda == '01' ? this.tipoGastoSeleccionado.codCuentaSoles : this.tipoGastoSeleccionado.codCuentaDolares;
      this.tipoGastoSeleccionado = new MaeTipoGasto();
      this.ordenPagoDet.codCuentaConcepto = undefined;
    } else {
      this.tipoGastoSeleccionado = this.tiposGasto.find(tg => tg.codTipoGasto == this.ordenPagoDet.codTipoGasto) ?? new MaeTipoGasto();
      const cuentaConcepto = this.tiposGasto.find(tg => tg.codTipoGasto == this.ordenPagoDet.codTipoGasto);
      this.ordenPagoDet.codCuentaConcepto = this.ordenPagoDet.codMoneda == '01' ? cuentaConcepto?.codCuentaSoles : cuentaConcepto?.codCuentaDolares;
      this.ordenPagoDet.codCuentaDocumento =
        this.ordenPagoDet.codMoneda == '01' ? this.documentoSeleccionado.codCuentaSoles : this.documentoSeleccionado.codCuentaDolares;
    }
    this.getImpuestos();
    this.validarTipoDocumentoPorRuc(true); // emite alerta si la combinación es ilegal
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Regla SUNAT: RUC que empieza con "20" = persona jurídica.
  //  En ese caso el proveedor SOLO puede emitir facturas (códigos F*).
  //  Si el usuario u OCR seleccionan boleta / recibo / nota, se bloquea
  //  el guardado y se muestra advertencia.
  // ──────────────────────────────────────────────────────────────────────

  /** True cuando la combinación RUC+TipoDoc viola la regla y bloquea Guardar. */
  bloqueoTipoDoc: boolean = false;
  /** Mensaje descriptivo del bloqueo (se muestra debajo del select). */
  mensajeTipoDoc: string = '';

  /**
   * Valida que un RUC 20XXXXXXXXX (persona jurídica) solo acepte facturas
   * como tipo de documento. Si la regla se viola:
   *   - bloqueoTipoDoc = true
   *   - mensajeTipoDoc = explicación corta
   *   - (opcional) Swal advirtiendo al usuario.
   *
   * @param mostrarAlerta cuando viene desde el (change) del select del
   *                      usuario, mostramos Swal. Cuando viene desde el
   *                      OCR (precarga automática) no, para no estorbar.
   */
  validarTipoDocumentoPorRuc(mostrarAlerta: boolean = false): boolean {
    const ruc = (this.ruc || '').trim();
    const cod = (this.codDocumentoGeneral || '').toString().trim().toUpperCase();

    // Sin RUC o sin tipo aún → no validamos.
    if (!ruc || !cod || cod === 'SD') {
      this.bloqueoTipoDoc = false;
      this.mensajeTipoDoc = '';
      return true;
    }

    // Persona jurídica = RUC empieza con "20".
    const esPersonaJuridica = ruc.startsWith('20');
    // Facturas = códigos que empiezan con 'F' (F, FV, FC, FH, etc).
    const esFactura = cod.startsWith('F');

    if (esPersonaJuridica && !esFactura) {
      this.bloqueoTipoDoc = true;
      const descActual = this.documentos.find(d => d.codDocumento === cod)?.desDocumento || cod;
      this.mensajeTipoDoc =
        `El RUC ${ruc} corresponde a una persona jurídica (inicia con 20). ` +
        `Solo se aceptan FACTURAS — el tipo seleccionado "${descActual}" no es válido.`;
      if (mostrarAlerta) {
        Swal.fire({
          icon: 'warning',
          title: 'Tipo de documento no permitido',
          html: `<div style="text-align:left;">
                   <p>El RUC <strong>${ruc}</strong> corresponde a una <strong>persona jurídica</strong>
                      (inicia con <code>20</code>).</p>
                   <p>Las personas jurídicas SUNAT solo pueden emitir <strong>facturas</strong>.</p>
                   <p>Cambie el tipo a una variante de Factura (F001, FE, FV…) para poder guardar.</p>
                 </div>`,
          confirmButtonText: 'Entendido'
        });
      }
      return false;
    }

    // Regla cumplida.
    this.bloqueoTipoDoc = false;
    this.mensajeTipoDoc = '';
    return true;
  }

  /**
   * Listener del input de RUC. Cada vez que el usuario edita el RUC:
   *   1) Re-evalúa la regla "RUC 20XXX = solo facturas".
   *   2) Resetea la selección de anexos previa (cambia el proveedor).
   *   3) Si el RUC ya está completo y es válido (11 dígitos), precarga
   *      los establecimientos anexos del nuevo RUC en segundo plano.
   *
   * NOTA: no llama a SUNAT en cada keystroke — espera a tener 11 dígitos
   * y aplica un pequeño debounce para evitar múltiples consultas mientras
   * el usuario aún está escribiendo.
   */
  private _rucDebounce: any = null;

  onRucManualChange(nuevoRuc: any): void {
    const r = (nuevoRuc || '').toString().trim();

    // Si cambia el proveedor (RUC distinto al cacheado), reseteamos el
    // anexo previo y la validación de SUNAT.
    if (r !== this._ultRucAnexos) {
      this.anexoSeleccionado = null;
      this.anexosDisponibles = [];
      this.validaComprobante = false;  // forzar revalidar SUNAT
    }

    // Validación instantánea de la regla "RUC 20XXX = solo facturas"
    this.validarTipoDocumentoPorRuc(false);

    // Carga de anexos: solo cuando ya hay 11 dígitos válidos, con debounce
    // de 500ms para evitar spammear al backend si el usuario aún tipea.
    if (this._rucDebounce) clearTimeout(this._rucDebounce);
    if (/^\d{11}$/.test(r)) {
      this._rucDebounce = setTimeout(() => {
        this.cargarAnexosDelRuc(r, { silencioso: true });
      }, 500);
    }
  }

  changeNumDocumento() {
    const partes = this.dataImagen.documentNumber?.split('-');
    if (partes?.length === 2) {
      const serie = partes[0];
      const numero = partes[1].padStart(15, '0');
      this.dataImagen.documentNumber = (serie + "-" + numero).toUpperCase();
    }
  }

  onMonedaChange() {
  }

  private handleRucResponse(response: Response, skipRule = false): void {
    if (!response || response.error !== 0) {
      this.hasValidRules = false;
      this.hasValidState();
      return;
    }
    this.padronRuc = response.resultado;

    // Si SUNAT devolvió una "dirección" disfrazada como nombre comercial
    // (caso típico Plaza Vea, Tottus: "AV. SAN BORJA NORTE 1234, SAN BORJA"),
    // descartarla — no es el nombre comercial real.
    const ncSunat = (this.padronRuc?.nombreComercial || '').trim();
    if (ncSunat && this.pareceDireccion(ncSunat)) {
      this.padronRuc.nombreComercial = '';
    }

    // Preservar nombre comercial detectado por OCR si SUNAT no devuelve uno
    // útil. SUNAT solo entrega razón social en muchos casos, así que el
    // branding del documento (HOSTAL SHALOM, POLLERIA X) viene del OCR.
    const ncSunatFinal = (this.padronRuc?.nombreComercial || '').trim();
    if (!ncSunatFinal && this.commercialNameOcr && !this.pareceDireccion(this.commercialNameOcr)) {
      this.padronRuc.nombreComercial = this.commercialNameOcr;
    }

    this.mensaje = '';
    this.hasValidRules = true;
    this.hasValidState();
    this.dataImagen.issuerAddress = this.buildDireccion(this.padronRuc);
    this.validateRules({ skipRule });

    // Cargar establecimientos anexos del RUC (no bloqueante).
    this.cargarAnexosDelRuc(this.ruc);
  }

  /**
   * Consulta los establecimientos anexos del RUC al backend Regina-API-Process.
   * Se dispara cuando: (a) cambia el RUC, (b) termina el OCR con RUC detectado,
   * (c) el usuario abre el modal por primera vez.
   *
   * Reset también `anexoSeleccionado` porque al cambiar de proveedor la
   * selección previa ya no aplica.
   */
  cargarAnexosDelRuc(ruc: string, opts: { silencioso?: boolean } = {}): void {
    const r = (ruc || '').trim();
    if (!r || !/^\d{11}$/.test(r)) {
      this.anexosDisponibles = [];
      this.anexoSeleccionado = null;
      this._ultRucAnexos = '';
      return;
    }
    if (r === this._ultRucAnexos && this.anexosDisponibles.length > 0) {
      return; // ya está cargado para este RUC
    }

    this._ultRucAnexos = r;
    this.anexoSeleccionado = null;   // nuevo RUC → reset selección
    this.anexosDisponibles = [];
    this.cargandoAnexos = true;
    console.log(`[edit-rendir-cuenta] Cargando anexos del RUC ${r}…`);

    this.sunatAnexosService.consultarAnexos(r).subscribe({
      next: (data: RucAnexosResponse) => {
        this.anexosDisponibles = data?.anexos ?? [];
        this.cargandoAnexos = false;
        console.log(`[edit-rendir-cuenta] RUC ${r}: ${this.anexosDisponibles.length} anexo(s) cargados`);

        // Si la respuesta incluye razón social/nombre comercial y el
        // padron actual no los tiene, los enriquecemos.
        if (this.padronRuc) {
          if (!this.padronRuc.nombreComercial && data?.nombreComercial) {
            this.padronRuc.nombreComercial = data.nombreComercial;
          }
        }
      },
      error: (err) => {
        this.cargandoAnexos = false;
        this.anexosDisponibles = [];
        this._ultRucAnexos = '';     // permitir reintentar
        const mensaje = err?.error?.mensaje
                     || err?.message
                     || 'No fue posible consultar SUNAT.';
        console.error('[edit-rendir-cuenta] Error consultando anexos:', err);

        if (!opts.silencioso) {
          Swal.fire({
            icon: 'error',
            title: 'No se pudieron cargar los establecimientos',
            html: `<div style="text-align:left;">
                     <p>SUNAT no devolvió la lista de anexos para el RUC <strong>${r}</strong>.</p>
                     <p class="text-muted" style="font-size:0.85em;"><strong>Detalle técnico:</strong> ${mensaje}</p>
                     <hr>
                     <p>Puede intentar:</p>
                     <ul>
                       <li>Verificar que el RUC sea correcto.</li>
                       <li>Reintentar en unos segundos (SUNAT puede estar saturado).</li>
                       <li>Si el problema persiste, registre el comprobante manualmente.</li>
                     </ul>
                   </div>`,
            confirmButtonText: 'Entendido',
          });
        }
      }
    });
  }

  /**
   * Abre el modal para elegir el establecimiento anexo del proveedor.
   * Si la lista aún no está cargada, primero la carga y luego abre el modal.
   */
  abrirSelectorAnexos(): void {
    const ruc = (this.ruc || '').trim();
    if (!ruc) {
      Swal.fire({
        icon: 'info',
        title: 'RUC requerido',
        text: 'Primero ingrese el RUC del proveedor para consultar sus establecimientos anexos.',
      });
      return;
    }

    const abrir = () => {
      if (!this.anexosDisponibles || this.anexosDisponibles.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'Sin establecimientos',
          text: `El RUC ${ruc} no tiene establecimientos anexos registrados en SUNAT, o aún no fueron consultados.`,
        });
        return;
      }

      const ref = this.dialog.open(AnexoSelectorDialogComponent, {
        width: '920px',
        maxWidth: '95vw',
        autoFocus: false,
        data: <AnexoSelectorData>{
          ruc,
          razonSocial: this.padronRuc?.razonSocial,
          anexos: this.anexosDisponibles,
          seleccionPrevia: this.anexoSeleccionado
        }
      });

      ref.afterClosed().subscribe((seleccion: EstablecimientoAnexo | null) => {
        if (seleccion) {
          this.anexoSeleccionado = seleccion;
          // Reemplazar la dirección por la del anexo elegido
          this.dataImagen.issuerAddress = (seleccion.direccion || '').trim();
        }
      });
    };

    // Si aún no se cargaron, cargar y luego abrir.
    if (this.cargandoAnexos) {
      Swal.fire({
        icon: 'info',
        title: 'Cargando',
        text: 'Aún se están cargando los establecimientos del RUC. Intente en unos segundos.',
      });
      return;
    }
    if (!this.anexosDisponibles.length && ruc !== this._ultRucAnexos) {
      this.cargarAnexosDelRuc(ruc);
      // Pequeño delay para que termine la carga antes de abrir.
      setTimeout(abrir, 800);
    } else {
      abrir();
    }
  }

  private buildDireccion(data: PadronRuc): string {
    const parts = [
      data.tipoVia && data.nombreVia ? `${data.tipoVia} ${data.nombreVia}` : '',
      data.codZona && data.tipoZona ? `${data.codZona} ${data.tipoZona}` : '',
      data.numero ? `NRO. ${data.numero}` : '',
      data.interior ? `INT. ${data.interior}` : '',
      data.manzana && data.manzana !== '-' ? `MZA. ${data.manzana}` : '',
      data.lote && data.lote !== '-' ? `LTE. ${data.lote}` : ''
    ];
    return parts.filter(Boolean).join(' ').trim();
  }

  private handleRucError(error?: HttpErrorResponse): void {
    let message = error?.error.mensaje || 'No se pudo consultar SUNAT. Intente nuevamente.';
    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Error',
        message,
        type: 'alert'
      }
    });
    this.hasValidRules = false;
    this.hasValidState();
    this.mensaje = message;
  }

  onSelectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    this.loadingService.show();
    const file = input.files[0];
    this.selectedFile = file;

    if (this.isPdfFile(file)) {
      this.imageChangedEvent = null;
      this.previewImage = null;
      this.croppedImage = null;
      this.showImageCropper = false;
      this.setPdfPreview(file);
      this.processFile(file);
      return;
    }

    this.imageChangedEvent = event;
    this.showImageCropper = true;
    this.clearPdfPreview();
    this.loadPreview(file);
    this.processFile(file);
  }

  private loadPreview(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.previewImage = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Envía el archivo al OCR backend.
   * @param file Archivo a procesar.
   * @param enhance Si es true se activa la doble pasada con mejora fuerte de
   *   imagen en el backend (Nivel 3). Se usa solo cuando el usuario eligió
   *   "Mejorar la imagen" tras un documento no legible.
   * @param suppressLegibilityDialog Si es true, no vuelve a abrir el diálogo
   *   de legibilidad aunque el score siga bajo — evita loops infinitos al
   *   reintentar con enhance=true.
   */
  private processFile(
    file: File,
    enhance: boolean = false,
    suppressLegibilityDialog: boolean = false,
  ): void {
    this.ocrService.uploadFile(file, enhance).subscribe({
      next: (response: any) => {
        const detected = response?.detectedData;
        if (!detected) {
          return;
        }

        // Si el documento no es legible, preguntar al usuario qué hacer
        // (mejorar la imagen o registrar manualmente) antes de mapear datos.
        // Pero NO volver a preguntar si ya estamos en un reintento con enhance.
        if (!suppressLegibilityDialog && !this.esDocumentoLegible(detected)) {
          this.handleNotLegible(detected);
          return;
        }

        // El documento es legible: limpia el flag de entrada manual y procede normal.
        this.requireManualEntry = false;

        //No debe permitir rendir el mismo documento para diferentes OP.
        const isValidDoc = this.mapDetectedData(detected);
        if (isValidDoc) {
          this.onGetDatosRuc();
        }
      },
      error: (err) => {
        console.error(err);
        this.loadingService.hide();
      },
      complete: () => {
        this.loadingService.hide();
      }
    });
  }

  private setPdfPreview(file: File): void {
    this.clearPdfPreview();
    this.pdfObjectUrl = URL.createObjectURL(file);
    this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl);
    this.showPdfPreview = true;
  }

  private clearPdfPreview(): void {
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
    }
    this.pdfObjectUrl = null;
    this.pdfPreviewUrl = null;
    this.showPdfPreview = false;
  }

  private isPdfFile(file: File): boolean {
    const name = file.name?.toLowerCase() || '';
    return file.type === 'application/pdf' || name.endsWith('.pdf');
  }

  private getFileExtension(file: File): string {
    const name = file.name || '';
    const dot = name.lastIndexOf('.');
    if (dot === -1) {
      return '';
    }
    return name.substring(dot + 1).toUpperCase();
  }

  /**
   * Verifica si el OCR devolvió un documento "legible".
   * Criterio combinado:
   *  - score >= umbral configurado en BD (regla OCR_MIN_LEGIBILIDAD), OR
   *  - al menos 3 de 4 campos críticos extraídos: RUC válido, número de
   *    documento con formato, fecha y monto > 0.
   * Si no hay regla configurada, se considera legible por defecto.
   */
  private esDocumentoLegible(detected: any): boolean {
    if (!detected) return false;

    const regla = this.reglas.find(r => r.fieldCode === 'OCR_MIN_LEGIBILIDAD');
    const umbral = Number(regla?.maxValue);
    const score = Number(detected.legibilityScore);

    // Sin regla → no se valida legibilidad
    if (!regla || !Number.isFinite(umbral) || umbral <= 0) {
      return true;
    }

    // Score por encima del umbral → legible
    if (Number.isFinite(score) && score >= umbral) {
      return true;
    }

    // Fallback: 3 de 4 campos críticos presentes → también lo aceptamos
    const tieneRuc = Array.isArray(detected.issuerRuc) &&
      detected.issuerRuc.some((r: any) => typeof r === 'string' && r.length === 11);
    const tieneNumero = typeof detected.documentNumber === 'string' &&
      /[A-Z]\d{3}\s*-?\s*\d+/i.test(detected.documentNumber);
    const tieneFecha = !!detected.documentDate;
    const tieneMonto = Number(detected.amount) > 0;

    const camposOk = [tieneRuc, tieneNumero, tieneFecha, tieneMonto].filter(Boolean).length;
    return camposOk >= 3;
  }

  /**
   * Maneja el caso "documento no legible": abre un diálogo de opción múltiple
   * con dos acciones — mejorar la imagen o registrar manualmente — y ejecuta
   * el flujo correspondiente según la elección del usuario.
   */
  private handleNotLegible(detected: any): void {
    this.loadingService.hide();

    const ref = this.dialog.open(LegibilityChoiceDialogComponent, {
      width: '440px',
      disableClose: true,
      autoFocus: false,
    });

    ref.afterClosed().subscribe((choice: LegibilityChoice | undefined) => {
      switch (choice) {
        case 'IMPROVE':
          // Reenvía el MISMO archivo al backend con enhance=true para que
          // ejecute la pipeline OpenCV fuerte + doble pasada de OCR (Nivel 3).
          // No vuelve a abrir el diálogo aunque el score siga bajo —
          // si el segundo intento aún falla, el usuario verá el resultado y
          // podrá elegir entre cargar otro archivo o registrar manualmente.
          this.requireManualEntry = false;
          if (this.selectedFile) {
            console.log('🔬 [Mejorar imagen] reenviando con enhance=true');
            this.loadingService.show();
            this.processFile(this.selectedFile, true, true);
          } else {
            // Sin archivo en memoria: reabrir el selector como fallback.
            this.onDescartar();
            setTimeout(() => {
              const input = this.fileInputRef?.nativeElement;
              if (input) {
                input.value = '';
                input.click();
              }
            }, 200);
          }
          break;

        case 'MANUAL':
          // El usuario aceptó llenar manualmente. Cargamos lo poco que el OCR
          // alcanzó a detectar (si algo) y permitimos que edite los campos.
          this.requireManualEntry = true;
          const isValidDoc = this.mapDetectedData(detected);
          if (isValidDoc) {
            this.onGetDatosRuc();
          }
          break;

        case 'CANCEL':
        default:
          // El usuario cerró sin elegir: limpiamos el archivo para que vuelva a empezar.
          this.requireManualEntry = false;
          this.onDescartar();
          break;
      }
    });
  }

  private mapDetectedData(detected: any): boolean {
    console.log("Detected RAW TEXT:", detected.rawText);
    this.dataImagen.documentType = detected.documentType;
    if (this.dataImagen.documentType === DocumentType.NO_RECONOCIDO || !this.dataImagen.documentType) {
      this.mensaje = 'Tipo de documento no reconocido.'
      return false;
    }

    if (this.dataImagen.documentType) {
      this.documentos = this.documentosGeneral.filter(doc => doc.codDocumento?.substring(0, 1) == (this.dataImagen.documentType!));

      // Auto-seleccionar el tipo de documento que MEJOR encaje con el texto
      // detectado por OCR. Si el OCR dijo "BOLETA DE VENTA ELECTRÓNICA",
      // buscamos entre las opciones filtradas la que comparte más palabras
      // clave con esa frase (ej. "Boleta de Ventas").
      const mejor = this.findBestDocumentMatch(
        this.documentos,
        detected?.rawText || '',
        detected?.documentTypeText || detected?.documentTitle || ''
      );

      const elegido = mejor || this.documentos[0];
      this.ordenPagoDet.codDocumento = elegido?.codDocumento;
      this.ordenPagoDet.codCuentaDocumento =
        this.ordenPagoDet.codMoneda == '01' ? elegido?.codCuentaSoles : elegido?.codCuentaDolares;
      this.codDocumentoGeneral = this.ordenPagoDet.codDocumento!;
      this.documentoSeleccionado = elegido || new MaeDocumento();
    }

    this.dataImagen.documentNumber = detected.documentNumber;
    if (this.dataImagen.documentNumber) {
      const partes = this.dataImagen.documentNumber.split('-');
      if (partes.length === 2) {
        const serie = partes[0];
        const numero = partes[1].padStart(15, '0');

        this.dataImagen.documentNumber = `${serie}-${numero}`;
      }
    }

    this.dataImagen.issuerName = detected.issuerName;
    this.dataImagen.issuerAddress = detected.issuerAddress;
    this.dataImagen.documentDate = detected.documentDate;

    let date: Date;
    if (this.dataImagen.documentDate) {
      date = new Date(this.dataImagen.documentDate + 'T12:00:00');
    } else {
      date = new Date();
    }
    this.modelIni = {
      year: date.getFullYear(),
      month: date.getMonth() + 1, // meses van de 1 a 12
      day: date.getDate()
    };

    // Sincronizar el flag fechaDocValida con la fecha cargada por OCR
    // SIN mostrar el Swal (que solo debe aparecer cuando el USUARIO la cambia).
    this.fechaDocValida = this.isFechaValida(this.modelIni);

    this.dataImagen.amount = detected.amount || '0';
    this.dataImagen.igv = detected.igv || '0';

    this.getImpuestos();
    console.log("Orden Pago Det : ", this.ordenPagoDet)

    //this.ordenPagoDet.impSoles = Number(this.dataImagen.amount);

    //this.subTotal = Number(this.dataImagen.amount) - Number(this.dataImagen.igv);

    this.dataImagen.documentCurrency = detected.documentCurrency;
    if (detected.documentCurrency) {
      this.monedas = this.monedasGeneral.filter(mon => mon.desAbreviatura === detected.documentCurrency
        || mon.desMoneda === detected.documentCurrency
        || mon.codMoneda === detected.documentCurrency
        || mon.codSunat === detected.documentCurrency
        || mon.codEquiv === detected.documentCurrency
      );
    } else {
      if (this.monedas.length > 0) {
        this.ordenPagoDet.codMoneda = this.monedas[0].codMoneda ?? '01';
      } else {
        this.monedas = this.monedasGeneral;
        this.ordenPagoDet.codMoneda = '01';
      }
    }

    this.dataImagen.items = detected.items;
    this.dataImagen.rawText = detected.rawText;

    const issuerRuc = detected.issuerRuc;
    this.dataImagen.issuerRuc = issuerRuc;
    this.ruc = Array.isArray(issuerRuc) ? issuerRuc[0] : issuerRuc;

    // Validar regla SUNAT: RUC 20XXXXXXXXX (persona jurídica) → solo facturas
    this.validarTipoDocumentoPorRuc(false);

    // Guardamos el nombre comercial detectado por OCR (logo/branding del documento).
    // Se preservará en handleRucResponse si SUNAT no devuelve uno propio.
    // Además lo asignamos a padronRuc para que el campo Proveedor lo muestre
    // de inmediato, aunque luego sea reemplazado por la respuesta de SUNAT.
    this.commercialNameOcr = (detected.commercialName || '').trim();
    // Filtro: no pegar la dirección del documento como nombre comercial.
    if (this.commercialNameOcr && this.pareceDireccion(this.commercialNameOcr)) {
      this.commercialNameOcr = '';
    }
    if (this.commercialNameOcr) {
      this.padronRuc.nombreComercial = this.commercialNameOcr;
    }

    this.cargarItems(this.dataImagen.items);
    return true;
  }

  /**
   * Bandera reactiva que indica si la fecha actual del documento es válida
   * respecto a la fecha de generación de la OP. Se usa en `isSaveDisabled()`
   * para bloquear el guardado sin necesidad de destruir los datos cargados.
   */
  fechaDocValida: boolean = true;

  isFechaValida(model: any): boolean {
    if (!model || !this.orden?.fecOrden) return false;

    const fechaOrden = new Date(this.orden.fecOrden);
    fechaOrden.setHours(0, 0, 0, 0);

    // Convertir NgbDateStruct a Date
    const fechaModel = new Date(model.year, model.month - 1, model.day);
    fechaModel.setHours(0, 0, 0, 0);

    // ❌ No puede ser menor que la fecha de la orden
    if (fechaModel < fechaOrden) return false;

    return true;
  }

  /**
   * Se dispara cuando el usuario cambia la fecha del documento.
   *
   * IMPORTANTE: NO debe limpiar los datos cargados del OCR — solo avisa al
   * usuario que la fecha está fuera de rango y bloquea el guardado mediante
   * `fechaDocValida = false` y `validaComprobante = false`. El usuario puede
   * corregir la fecha sin tener que volver a subir la imagen.
   */
  changeDate(): boolean {
    const ok = this.isFechaValida(this.modelIni);
    this.fechaDocValida = ok;

    if (!ok) {
      // Solo bloqueamos visualmente con el flag fechaDocValida (lo lee
      // isSaveDisabled). NO tocamos validaComprobante — así, al corregir
      // la fecha el botón vuelve a habilitarse SIN necesidad de re-validar
      // SUNAT (porque el comprobante por RUC+serie+número sigue siendo el
      // mismo; SUNAT no depende de la fecha del documento).
      // Tampoco tocamos this.dataImagen / padronRuc / ordenPagoDet.
      const fechaOrdenTxt = this.orden?.fecOrden
        ? new Date(this.orden.fecOrden).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';

      Swal.fire({
        icon: 'warning',
        title: 'Fecha del documento inválida',
        html: `La fecha del documento no puede ser <b>menor</b> que la fecha de generación de la Orden de Pago` +
              (fechaOrdenTxt ? ` (<b>${fechaOrdenTxt}</b>).` : '.') +
              `<br><br><em>Los datos del comprobante se mantienen — corrija la fecha para habilitar el guardado.</em>`,
        confirmButtonText: 'Entendido'
      });

      return false;
    }

    // Fecha OK: recalcular validaciones que dependan de la fecha (periodo
    // contable, etc.) sin destruir lo cargado.
    if (typeof this.onPeriodoDeclaracionChange === 'function') {
      try { this.onPeriodoDeclaracionChange(); } catch { /* noop */ }
    }
    return true;
  }

  cargarItems(data: any) {
    this.itemsText = data
      .map((item: any) => Object.values(item).join(' '))
      .join('\n');
  }

  onDetalleChange(value: string): void {
    const rule = this.reglas.find(r => r.fieldCode === FieldCode.DOCUMENT_ITEMS);
    if (!rule || !value || value.trim().length === 0) {
      this.mensajeDetalle = '';
      this.hasValidItems = true;
      this.hasValidState();

      return;
    }

    const context: ValidationContext = {
      dataImagen: {
        issuerRuc: [this.ruc],
        items: [{ descripcion: value }]
      },
      padronRuc: this.padronRuc,
      forbiddenKeywords: this.keywords
    };

    const error = this.validationEngine.validateRule(rule, context);
    this.mensajeDetalle = error || '';

    this.hasValidItems = !error;
    this.hasValidState();
  }

  ruccompleto(): void {
    if (this.ruc.length !== RucInput.LENGTH) {
      this.mensaje = 'El RUC debe contener 11 dígitos.';
      this.hasValidRules = false;
      this.hasValidState();

      return;
    }

    this.onGetDatosRuc(true);
  }

  onImageCropped(event: ImageCroppedEvent): void {
    if (event.base64) {
      this.croppedImage = event.base64;
      return;
    }
    if (event.blob) {
      const reader = new FileReader();
      reader.onload = () => {
        this.croppedImage = reader.result as string;
      };
      reader.readAsDataURL(event.blob);
    }
  }

  toggleImageCropper(): void {
    this.showImageCropper = !this.showImageCropper;
  }

  togglePdfPreview(): void {
    this.showPdfPreview = !this.showPdfPreview;
  }

  async runOcr(): Promise<void> {
    try {
      const result = await Tesseract.recognize(
        this.croppedImage ?? '',
        'spa',
        {
          logger: m => console.log(m)
        }
      );
      this.recognizedText = result.data.text;
      await this.copyToClipboard(this.recognizedText);
    } catch (err) {
      console.error('Error OCR:', err);
    }
  }

  async copyToClipboard(text: string): Promise<void> {
    if (!text || !text.trim()) {
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  onClose() {
    this.orden = new OrdenPago();
    this.dataImagen = new DatosImagen();
    this.imageChangedEvent = null;
    this.previewImage = null;
    this.croppedImage = null;
    this.clearPdfPreview();
    this.showPdfPreview = false;
    this.selectedFile = undefined;
    this.showImageCropper = true;
    this.recognizedText = '';
    this.detalle = '';
    this.ruc = "";
    this.router.navigate(['/list-orders']);
  }

  subirArchivo(wrapper: WrapperUploadDocumento, event?: any) {
    if (!event || !event.target || !event.target.files || event.target.files.length === 0) {
      return;
    }
    const file: File = event.target.files[0];
    if (!file) {
      return;
    }
    this.documentoService
      .uploadFile(wrapper)
      .subscribe({
        next: (resp) => {
          console.log('Archivo subido', resp);
        },
        error: (err) => {
          console.error('Error', err);
        }
      });
  }

  onSaveAuxiliar(): void {
    let aux: MaeAuxiliarDTO | undefined = this.listaAuxiliares.find(aux => aux.numRuc == this.ruc);
    if (!aux) {
      aux = new MaeAuxiliarDTO();
      aux.codEmpresa = this.codEmpresa;
      aux.codTipoAuxi = "PR";
      aux.desAuxiliar = this.padronRuc.razonSocial;
      aux.numDocIdentidad = "";
      aux.numEmail = "";
      aux.numRuc = this.ruc;
      aux.tipEstado = "";
      this.maestrosService.insertarAuxiliar(aux).subscribe(
        (response: Response) => {
          this.codAuxiliar = response.resultado;
          this.ordenPagoDet.codAuxiliar = response.resultado;
          this.onSave();
        }
      )
    } else {
      this.ordenPagoDet.codAuxiliar = aux.codAuxiliar;
      this.onSave()
    }

  }

  async onSave() {
    const existe: number = await this.onBuscarDocumento();

    if (existe == 0) {

      const numserie = this.dataImagen.documentNumber?.split('-')[0] ?? '';
      const numdoc = this.dataImagen.documentNumber?.split('-')[1] ?? '';

      this.ordenPagoDet.codEmpresa = this.codEmpresa;
      this.ordenPagoDet.numOrden = this.orden.numOrden;
      this.ordenPagoDet.codCuentaConcepto = this.tipoGastoSeleccionado.codCuentaSoles;
      this.ordenPagoDet.codSucursal = this.orden.codSucursal;

      this.rubroSeleccionado = this.rubros.find(r => r.codRubro === this.ordenPagoDet.codRubro) ?? new MaeRubro();
      this.tipoGastoSeleccionado = this.tiposGasto.find(t => t.codTipoGasto === this.ordenPagoDet.codTipoGasto) ?? new MaeTipoGasto();
      this.documentoSeleccionado = this.documentos.find(d => d.codDocumento === this.ordenPagoDet.codDocumento) ?? new MaeDocumento();


      this.ordenPagoDet.codDocumento = this.codDocumentoGeneral;

      if (this.modelIni) {
        const { year, month, day } = this.modelIni;
        this.dataImagen.documentDate =
          `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }

      this.ordenPagoDet.anoEmisionDua = this.dataImagen.documentDate ? String(new Date(this.dataImagen.documentDate).getFullYear()) : undefined;

      // ====== MES / AÑO DE DECLARACIÓN (obligatorio · obs. usuario) ======
      this.ordenPagoDet.anoProcesoDeclara = String(this.anioDeclaracion ?? new Date().getFullYear());
      this.ordenPagoDet.mesProcesoDeclara = String(this.mesDeclaracion ?? (new Date().getMonth() + 1)).padStart(2, '0');

      this.ordenPagoDet.codAuxiliar = this.codAuxiliar;

      // ====== CENTRO DE COSTOS heredado de la OP (solo lectura · obs. usuario) ======
      this.ordenPagoDet.codCCostos = this.orden.codCCostos;

      this.ordenPagoDet.codCuentaConcepto = this.ordenPagoDet.codMoneda === '01' ? this.tipoGastoSeleccionado.codCuentaSoles : this.tipoGastoSeleccionado.codCuentaDolares;
      this.ordenPagoDet.codCuentaDocumento = this.ordenPagoDet.codMoneda === '01' ? this.documentoSeleccionado.codCuentaSoles : this.documentoSeleccionado.codCuentaDolares;
      this.ordenPagoDet.numVerPlanCuentas = '001';
      this.ordenPagoDet.numVerCCostos = '001';
      this.ordenPagoDet.indDebeHaber = 'D';

      this.ordenPagoDet.fecDocumento = this.dataImagen.documentDate ? new Date(this.dataImagen.documentDate) : new Date();

      this.ordenPagoDet.estDocIng = 'TO';
      this.ordenPagoDet.indDet = 'N';

      this.ordenPagoDet.codEmpresa = this.codEmpresa;
      this.ordenPagoDet.codSucursal = '001';

      this.ordenPagoDet.numSerieDoc = numserie;
      this.ordenPagoDet.numDocumento = numdoc;
      const tipoCambioStorage = sessionStorage.getItem('tipocambio');
      this.ordenPagoDet.tipCambio = tipoCambioStorage
        ? JSON.parse(tipoCambioStorage).impVenta ?? 1
        : 1;
      if (this.ordenPagoDet.codMoneda == '01') {
        this.ordenPagoDet.impSoles = Number(this.dataImagen.amount) || 0;
        this.ordenPagoDet.impDolares = this.ordenPagoDet.impSoles / (this.ordenPagoDet.tipCambio ?? 1);
      } else {
        this.ordenPagoDet.impDolares = Number(this.dataImagen.amount) || 0;
        this.ordenPagoDet.impSoles = this.ordenPagoDet.impDolares * (this.ordenPagoDet.tipCambio ?? 1);
      }

      // ====== % IGV EDITABLE (obs. usuario) ======
      // Se usa el porcentaje configurado por el usuario en el formulario
      const totalPorcentaje = 1 + ((this.igvPercent || 0) / 100);
      this.ordenPagoDet.impImponSoles = totalPorcentaje > 0 ? this.ordenPagoDet.impSoles / totalPorcentaje : this.ordenPagoDet.impSoles;
      this.ordenPagoDet.impImponDolares = totalPorcentaje > 0 ? this.ordenPagoDet.impDolares / totalPorcentaje : this.ordenPagoDet.impDolares;

      this.ordenPagoDetService.saveOrdenPagoDet(this.ordenPagoDet).subscribe(
        (response: Response) => {
          const error: number = response.error ?? 0;
          if (error == 1) {

            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: 'Error',
                message: "Error al guardar la Rendición de Cuenta",
                type: 'alert'
              }
            });
          } else {

            this.nroItemOp = response.resultado;

            let wrapper: WrapperUploadDocumento = new WrapperUploadDocumento();

            wrapper.file = this.selectedFile;
            wrapper.anioPeriodo = this.orden.anoPeriodo;
            wrapper.mesPeriodo = this.orden.codPeriodo;
            wrapper.codEmpresa = this.orden.codEmpresa;
            wrapper.codSucursal = this.orden.codSucursal;
            wrapper.extension = this.selectedFile ? this.getFileExtension(this.selectedFile) : '';
            wrapper.numOrden = this.orden.numOrden;
            wrapper.numItem = this.nroItemOp;
            wrapper.tipoDocumento = this.ordenPagoDet.codDocumento;
            wrapper.serDocumento = this.ordenPagoDet.numSerieDoc;
            wrapper.numDocumento = this.ordenPagoDet.numDocumento;

            if (!this.selectedFile) {
              this.onSaveImpuestos();
              return;
            }

            this.documentoService.uploadFile(wrapper).subscribe(
              (response: any) => {
                this.onSaveImpuestos();
              }
            )
          }
        }
      )
    } else {
      this.dialog.open(ConfirmDialogComponent, {
        width: '280px',
        data: {
          title: 'Alerta',
          message: "El documento ya existe.",
          type: 'alert'
        }
      });
    }
  }

  onSaveImpuestos() {
    this.ordenPagoDetProvs = [];
    for (let e = 0; e < this.impuestos.length; e++) {
      const ordenPagoDetProv = new OrdenPagoDetProv();
      ordenPagoDetProv.impImpuestoBase = (this.ordenPagoDet.impSoles ?? 0) - ((this.ordenPagoDet.impSoles ?? 0) / (1 + (this.impuestos[e].numPorcentaje ?? 0) / 100));
      ordenPagoDetProv.impImpuestoSecun = (this.ordenPagoDet.impDolares ?? 0) - ((this.ordenPagoDet.impDolares ?? 0) / (1 + (this.impuestos[e].numPorcentaje ?? 0) / 100));
      ordenPagoDetProv.codEmpresa = this.codEmpresa;
      ordenPagoDetProv.codSucursal = '001';
      ordenPagoDetProv.numOrden = this.orden.numOrden;
      ordenPagoDetProv.anoProceso = sessionStorage.getItem('periodo_year') || '';
      ordenPagoDetProv.mesProceso = sessionStorage.getItem('periodo_month') || '';
      ordenPagoDetProv.codDocumento = this.ordenPagoDet.codDocumento;
      ordenPagoDetProv.codImpuesto = this.impuestos[e].codImpuesto;
      ordenPagoDetProv.indAfecto = 'S';
      this.ordenPagoDetProvs.push(ordenPagoDetProv);
    }
    this.ordenPagoDetProvService.saveOrdenPagoDetProv(this.ordenPagoDetProvs).subscribe(
      (response: any) => {
        this.onBack();
      }
    )
  }

  onDescartar() {
    this.inicializa();
  }

  onListaAuxiliares() {
    this.maestrosService.getListaAuxiliaresPR(this.codEmpresa).subscribe(
      (response: Response) => {
        this.listaAuxiliares = response.resultado;
        this.loadingService.hide();
      },
      (error) => {
        this.loadingService.hide();
      }
    )
  }

  private hasValidState(): void {
    this.validate = this.hasValidRules && this.hasValidItems;
  }

  devolverDocumento(tipoDoc: string): string {
    return this.documentosGeneral
      .find(doc => doc.codDocumento == tipoDoc)
      ?.desDocumento ?? '';
  }

  onChangeTipoGasto() {
    this.tipoGastoSeleccionado = this.tiposGasto.find(
      tg => tg.codTipoGasto == this.ordenPagoDet.codTipoGasto
    ) ?? new MaeTipoGasto();
    this.getMonedas();
  }

  isSaveDisabled(): boolean {
    const docNum = (this.dataImagen.documentNumber || '').trim();
    const subTotal = Number(this.subTotal);
    const total = Number(this.total);
    const isDocNumValid = this.isDocumentNumberValid(docNum);

    // Mes/Año de declaración obligatorios
    if (!this.mesDeclaracion || !this.anioDeclaracion) {
      return true;
    }
    // % IGV válido
    if (this.igvPercent === null || this.igvPercent === undefined || this.igvPercent < 0 || this.igvPercent > 100) {
      return true;
    }

    // 🔒 El comprobante debe haber sido validado con SUNAT (botón "Validar Comprobante").
    // `validaComprobante` arranca en false y solo se vuelve true cuando SUNAT
    // responde estadoCp === '1' en validarComprobante().
    if (!this.validaComprobante) {
      return true;
    }

    // 🔒 Debe existir un archivo (PDF o imagen) cargado para rendir el gasto.
    // Sin sustento físico no se permite guardar.
    if (!this.selectedFile) {
      return true;
    }

    // 🔒 Debe seleccionarse un Establecimiento Anexo del proveedor.
    // Solo lo exigimos cuando SÍ hay anexos disponibles para el RUC; si la
    // empresa no tiene anexos registrados, no bloqueamos.
    if (this.anexosDisponibles && this.anexosDisponibles.length > 0 && !this.anexoSeleccionado) {
      return true;
    }

    // 🔒 Regla SUNAT: RUC que inicia con "20" (persona jurídica) solo puede
    // emitir facturas. Si el comprobante es boleta/recibo/nota, bloqueamos.
    if (this.bloqueoTipoDoc) {
      return true;
    }

    // 🔔 La validación de fecha NO bloquea el guardado, solo emite la
    // advertencia (Swal) en changeDate(). El usuario debe poder guardar
    // aunque la fecha sea anterior a la OP — la decisión queda en sus manos.

    return !this.validate || !docNum || !isDocNumValid || subTotal === 0 || total === 0;
  }

  changeImporte(importe: Event | number) {
    const raw = typeof importe === 'number' ? importe : Number(importe as any);
    // Ignorar NaN: preservar el importe actual y no destruir el OCR.
    if (!Number.isFinite(raw)) { return; }
    this.total = raw;
    // Recálculo usando el % de IGV editable
    const totalPorcentaje = 1 + ((this.igvPercent || 0) / 100);
    this.subTotal = totalPorcentaje > 0 ? this.total / totalPorcentaje : this.total;
    this.impuesto = this.total - this.subTotal;
    // Recalcular saldo con debounce (evita parpadeo y múltiples Swal seguidos).
    this.recalcularSaldos();
  }

  /**
   * Recalcula `saldoSoles` y `saldoDolares` a partir del saldo base de la OP
   * y el importe actual del documento. Si el resultado queda en negativo,
   * muestra una advertencia (Swal) pero NO bloquea la operación.
   *
   * El recálculo se aplica con un debounce de 600 ms para evitar disparar la
   * alerta en cada tecla mientras el usuario edita el importe.
   */
  recalcularSaldos(): void {
    if (this._saldoDebounce) {
      clearTimeout(this._saldoDebounce);
    }
    this._saldoDebounce = setTimeout(() => {
      const importe = Number.isFinite(this.total) ? this.total : 0;
      // Determinar la moneda del documento para imputar el descuento al saldo
      // correcto. En Regina '01' = SOLES y cualquier otro código = DÓLARES.
      // Si no hay moneda en el detalle, se usa la moneda de la OP.
      const codMon = (this.ordenPagoDet?.codMoneda ||
                      this.orden?.codMoneda ||
                      '01').toString();
      const esDolares = codMon !== '01';

      if (esDolares) {
        this.saldoDolares = (this._saldoBaseDolares || 0) - importe;
        this.saldoSoles = this._saldoBaseSoles || 0;
      } else {
        this.saldoSoles = (this._saldoBaseSoles || 0) - importe;
        this.saldoDolares = this._saldoBaseDolares || 0;
      }

      const negativo = esDolares ? this.saldoDolares < 0 : this.saldoSoles < 0;
      if (negativo) {
        const sigla = esDolares ? 'US$' : 'S/.';
        const saldoNeg = esDolares ? this.saldoDolares : this.saldoSoles;
        Swal.fire({
          icon: 'warning',
          title: 'Saldo en negativo',
          html: `El importe del documento <strong>excede el saldo disponible</strong>.<br>` +
                `Saldo proyectado: <strong>${sigla} ${saldoNeg.toFixed(2)}</strong>.<br>` +
                `<em>La operación no se bloquea — confirme si desea continuar.</em>`,
          confirmButtonText: 'Entendido'
        });
      }
    }, 600);
  }

  /**
   * Normaliza un texto para comparar: mayúsculas, sin tildes, sin signos,
   * espacios simples. "Boletá de Ventas" → "BOLETA DE VENTAS".
   */
  private normalize(s: string): string {
    if (!s) return '';
    return s
      .toString()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')   // quita tildes
      .toUpperCase()
      .replace(/[^A-Z0-9 ]+/g, ' ')      // quita signos
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Heurística para auto-seleccionar el "tipo de documento" más apropiado
   * cuando el OCR ha detectado una familia (ej. 'B' → boletas) pero la BD
   * tiene varias variantes ("Boleta", "Boleta de Ventas", "Boleto de Avión",
   * "Boleta No Emitida", etc.).
   *
   * Estrategia: para cada documento candidato calcula un score basado en
   * cuántas palabras significativas de su `desDocumento` aparecen en el
   * texto del comprobante (`rawText` + título detectado). El documento con
   * mayor score gana. Se favorece el match exacto con frases completas
   * (ej. "BOLETA DE VENTA") sobre matches parciales.
   *
   * Si ningún candidato supera el umbral mínimo, devuelve `null` y el
   * llamador usará el primero de la lista como fallback.
   */
  private findBestDocumentMatch(
    docs: MaeDocumento[],
    rawText: string,
    detectedTitle: string
  ): MaeDocumento | null {
    if (!docs || !docs.length) return null;

    // Texto del comprobante a buscar contra: título detectado + raw OCR.
    const haystack = this.normalize(`${detectedTitle || ''} ${rawText || ''}`);
    if (!haystack) return null;

    // Frases canónicas frecuentes en comprobantes peruanos.
    //
    // IMPORTANTE: el catálogo en pantalla solo contiene documentos de
    // COMPRA (los de venta están filtrados). Por eso, cuando el OCR detecta
    // un comprobante que el proveedor emite como VENTA ("FACTURA DE VENTA",
    // "FACTURA ELECTRONICA", "BOLETA DE VENTA"), debemos seleccionar el
    // equivalente de COMPRA en el catálogo del receptor.
    //
    // Así, las keywords buscan palabras presentes en la DESCRIPCIÓN del
    // documento del catálogo (ej. "FACTURA DE COMPRAS"), no las palabras
    // que aparecen en el comprobante físico.
    const frasesCanonicas: { regex: RegExp; keywords: string[] }[] = [
      // ─── FACTURA emitida por el proveedor → buscar "FACTURA … COMPRA" ───
      // Cubre: "FACTURA DE VENTA ELECTRONICA", "FACTURA ELECTRONICA",
      //        "FACTURA DE VENTA", "FACTURA COMERCIAL".
      { regex: /\bFACTURA\b/, keywords: ['FACTURA', 'COMPRA'] },

      // ─── BOLETA emitida por el proveedor → buscar "BOLETA … COMPRA" ───
      // Cubre: "BOLETA DE VENTA", "BOLETA DE VENTA ELECTRONICA".
      { regex: /\bBOLETA\b/, keywords: ['BOLETA', 'COMPRA'] },

      // ─── Documentos específicos cuya naturaleza es la misma desde
      //     ambos lados de la transacción ───
      { regex: /\bBOLETO\s+DE\s+AVION\b/,           keywords: ['BOLETO', 'AVION'] },
      { regex: /\bBOLETO\s+DE\s+TRANSPORTE\b/,      keywords: ['BOLETO', 'TRANSPORTE'] },
      { regex: /\bNOTA\s+DE\s+CREDITO\b/,           keywords: ['NOTA', 'CREDITO'] },
      { regex: /\bNOTA\s+DE\s+DEBITO\b/,            keywords: ['NOTA', 'DEBITO'] },
      { regex: /\bRECIBO\s+POR\s+HONORARIOS\b/,     keywords: ['RECIBO', 'HONORARIOS'] },
      { regex: /\bGUIA\s+DE\s+REMISION\b/,          keywords: ['GUIA', 'REMISION'] },
      { regex: /\bTICKET\b/,                        keywords: ['TICKET'] }
    ];

    // Stopwords a ignorar al puntuar.
    const stopwords = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'POR', 'EN', 'Y', 'A']);

    let mejor: MaeDocumento | null = null;
    let mejorScore = 0;

    for (const doc of docs) {
      const desc = this.normalize(`${doc.desDocumento || ''} ${doc.desCorta || ''}`);
      if (!desc) continue;

      const palabras = desc.split(' ').filter(w => w.length >= 3 && !stopwords.has(w));
      if (!palabras.length) continue;

      let score = 0;

      // 1) palabras de la descripción que aparecen en el haystack.
      for (const w of palabras) {
        if (haystack.includes(w)) score += 1;
      }

      // 2) bonus por frase canónica completa coincidente con la descripción.
      for (const fc of frasesCanonicas) {
        if (fc.regex.test(haystack) && fc.keywords.every(k => desc.includes(k))) {
          score += 5;
        }
      }

      // 3) bonus si la descripción aparece prácticamente entera en el texto.
      if (palabras.length >= 2 && palabras.every(w => haystack.includes(w))) {
        score += 3;
      }

      // 4) ligero bonus al codDocumento de dos letras (BV, FV) que suelen
      //    ser la variante "más comercial / más usada", frente a 'B' o 'F'
      //    que son tipos genéricos.
      const cod = (doc.codDocumento || '').toString();
      if (cod.length >= 2) score += 0.5;

      if (score > mejorScore) {
        mejorScore = score;
        mejor = doc;
      }
    }

    // Umbral mínimo: si nadie alcanza al menos 1 palabra coincidente, no
    // forzamos elección y dejamos que el caller use el fallback.
    return mejorScore >= 1 ? mejor : null;
  }

  /**
   * Heurística: detecta cuando SUNAT/OCR devuelve una dirección en lugar
   * de un nombre comercial real. Reglas:
   *  - empieza por prefijos típicos de dirección (AV., CAL., JR., MZ., etc.).
   *  - contiene patrón de número de calle ("Av. X 123").
   *  - termina en distrito/ciudad ("..., LIMA").
   */
  pareceDireccion(texto: string | undefined | null): boolean {
    if (!texto) return false;
    const t = texto.toString().trim().toUpperCase();
    if (!t) return false;

    const prefijos = [
      'AV.', 'AV ', 'AVENIDA',
      'CAL.', 'CAL ', 'CALLE',
      'JR.', 'JR ', 'JIRON', 'JIRÓN',
      'PSJ.', 'PSJ ', 'PASAJE',
      'MZ.', 'MZ ', 'MANZANA',
      'LT.', 'LOTE',
      'PROL.', 'PROLONGACION',
      'CARRT.', 'CARRETERA',
      'URB.', 'URBANIZACION',
      'PROLONGACIÓN'
    ];
    if (prefijos.some(p => t.startsWith(p))) return true;

    // Patrón "PALABRA NUMERO" típico de direcciones
    if (/^[A-ZÁÉÍÓÚÑ\.]+\s+\d{2,5}\b/.test(t)) return true;

    // Termina en ", LIMA" o ", <CIUDAD>"
    if (/,\s*(LIMA|AREQUIPA|CUSCO|TRUJILLO|PIURA|CHICLAYO|HUANCAYO|TACNA|ICA|CALLAO)\b/.test(t)) return true;

    return false;
  }

  /** Cuando el usuario cambia el % de IGV se recalculan importes. */
  onIgvPercentChange(): void {
    const totalPorcentaje = 1 + ((this.igvPercent || 0) / 100);
    if (totalPorcentaje > 0 && this.total > 0) {
      this.subTotal = this.total / totalPorcentaje;
      this.impuesto = this.total - this.subTotal;
    }
  }

  // ─── Formateo del % IGV con 2 decimales ───
  // Mantiene el valor numérico interno en `igvPercent` pero permite mostrar
  // siempre "18.00" en el input de pantalla (los inputs type="number" no
  // muestran ceros finales). El usuario puede escribir libremente y al perder
  // el foco se asegura el formato con 2 decimales.

  /** String que se muestra en el input (siempre con 2 decimales). */
  get igvPercentFormatted(): string {
    const v = Number(this.igvPercent);
    return Number.isFinite(v) ? v.toFixed(2) : '0.00';
  }

  /**
   * Setter usado por (ngModelChange) — parsea lo que el usuario va tecleando
   * (acepta coma o punto como separador decimal) y actualiza `igvPercent`.
   * NO reformatea aún para no interferir mientras se escribe.
   */
  setIgvPercent(value: any): void {
    if (value === null || value === undefined || value === '') {
      this.igvPercent = 0;
    } else {
      const cleaned = String(value).replace(',', '.').replace(/[^\d.]/g, '');
      const parts = cleaned.split('.');
      // Solo el primer punto cuenta como decimal, lo demás se ignora
      const normalized = parts.length > 1
        ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
        : cleaned;
      const num = parseFloat(normalized);
      this.igvPercent = Number.isFinite(num) ? Math.min(100, Math.max(0, num)) : 0;
    }
    this.onIgvPercentChange();
  }

  /**
   * Al perder foco redondea a 2 decimales y recalcula. Esto fuerza que el
   * input muestre "18.00" aunque el usuario haya tecleado "18".
   */
  onIgvPercentBlur(): void {
    const v = Number(this.igvPercent);
    this.igvPercent = Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
    this.onIgvPercentChange();
  }

  /**
   * Valida el periodo contable (mes/año declaración) contra la fecha del
   * documento. Si la diferencia en meses supera el máximo configurado en la
   * regla `PERIODO_CONTABLE_MAX_MESES` de REG_REN_VALIDATE, muestra mensaje.
   *
   * Se dispara cuando el usuario cambia el mes o el año de declaración.
   */
  onPeriodoDeclaracionChange(): void {
    this.mensajePeriodo = '';

    // Sin mes/año no podemos validar; el isSaveDisabled() ya marca como obligatorio
    if (!this.mesDeclaracion || !this.anioDeclaracion) {
      return;
    }

    // Sin fecha de documento no hay base para validar el periodo
    const docDateStr = this.dataImagen?.documentDate;
    if (!docDateStr) {
      return;
    }

    // Regla de máximo de meses (puede no estar configurada → no se valida)
    const regla = this.reglas.find(r => r.fieldCode === 'PERIODO_CONTABLE_MAX_MESES');
    const maxMeses = Number(regla?.maxValue);
    if (!regla || !Number.isFinite(maxMeses) || maxMeses <= 0) {
      return;
    }

    const docDate = new Date(docDateStr + 'T12:00:00');
    if (isNaN(docDate.getTime())) {
      return;
    }

    // Calcula diferencia en meses absolutos entre periodo declarado y fecha doc
    const docMonthIndex = docDate.getFullYear() * 12 + docDate.getMonth();
    const decMonthIndex = (this.anioDeclaracion) * 12 + (this.mesDeclaracion - 1);
    const diffMeses = Math.abs(decMonthIndex - docMonthIndex);

    if (diffMeses > maxMeses) {
      this.mensajePeriodo =
        regla.errorMessage ||
        `El periodo contable seleccionado supera el máximo permitido de ${maxMeses} meses respecto a la fecha del documento.`;
    }
  }

  private isDocumentNumberValid(value: string): boolean {
    if (!value) return false;

    const pattern = /^[A-Za-z0-9]{1,4}-\d{15}$/;
    return pattern.test(value.trim());
  }

  validarComprobante() {
    const { numeroSerie, numero } = this.parseNroDocumento(this.dataImagen.documentNumber ?? '');

    this.wrapper.rucConsultante = sessionStorage.getItem("ruc") ?? '';
    this.wrapper.numRuc = this.ruc;
    this.wrapper.codComp = this.documentos.filter(doc=>doc.codDocumento==this.codDocumentoGeneral)[0].codSunat;
    this.wrapper.numeroSerie = numeroSerie;
    this.wrapper.numero = numero;
    this.wrapper.fechaEmision = this.formatFecha(this.modelIni);
    this.wrapper.monto = String(this.total);

    console.log("Wrapper : ", this.wrapper);

    // Resetea el flag mientras se ejecuta la validación contra SUNAT.
    // El botón Guardar dependerá de que esto vuelva a true tras una respuesta exitosa.
    this.validaComprobante = false;

    this.sunatService.validarComprobante(this.wrapper).subscribe({
      next: (response: Response) => {
        const respuestaSunat = response.resultado;
        const data = respuestaSunat?.data ?? {};
        const estadoCp = String(data.estadoCp ?? '');

        // Catálogo de códigos SUNAT (estadoCp):
        //   0 = NO EXISTE  | 1 = ACEPTADO  | 2 = ANULADO
        //   3 = AUTORIZADO | 4 = NO AUTORIZADO
        const catalogoSunat: Record<string, { titulo: string; mensaje: string; tipo: 'success' | 'warning' | 'error'; valido: boolean }> = {
          '0': { titulo: 'Comprobante no existe',     mensaje: 'El comprobante NO EXISTE en los registros de SUNAT. Verifique RUC, serie y número.', tipo: 'error',   valido: false },
          '1': { titulo: 'Validación correcta',       mensaje: 'El comprobante fue ACEPTADO por SUNAT.',                                              tipo: 'success', valido: true  },
          '2': { titulo: 'Comprobante anulado',       mensaje: 'El comprobante fue ANULADO en SUNAT. No es válido para sustento de gasto.',           tipo: 'error',   valido: false },
          '3': { titulo: 'Comprobante autorizado',    mensaje: 'El comprobante está AUTORIZADO por SUNAT.',                                           tipo: 'success', valido: true  },
          '4': { titulo: 'Comprobante no autorizado', mensaje: 'El comprobante NO ESTÁ AUTORIZADO por SUNAT.',                                        tipo: 'error',   valido: false },
        };

        const info = catalogoSunat[estadoCp] ?? {
          titulo: 'Respuesta SUNAT desconocida',
          mensaje: `SUNAT devolvió un estado no contemplado (estadoCp = "${estadoCp}"). Comuníquese con soporte.`,
          tipo: 'warning' as const,
          valido: false,
        };

        // Datos adicionales útiles para el usuario (estado del RUC, condición de
        // domicilio, observaciones). Se muestran solo si vienen en la respuesta.
        //
        // SUNAT codifica algunos valores numéricamente y debemos traducirlos:
        //   estadoRuc:    "00" → ACTIVO        | otro → NO ACTIVO
        //   condDomiRuc:  "00" → HABIDO        | otro → NO HABIDO
        const estadoRucTxt = data.estadoRuc !== undefined && data.estadoRuc !== null && data.estadoRuc !== ''
          ? (String(data.estadoRuc) === '00' ? 'ACTIVO' : 'NO ACTIVO')
          : '';
        const condDomiTxt = data.condDomiRuc !== undefined && data.condDomiRuc !== null && data.condDomiRuc !== ''
          ? (String(data.condDomiRuc) === '00' ? 'HABIDO' : 'NO HABIDO')
          : '';

        // Color visual para resaltar valores positivos vs negativos
        const colorEstado = estadoRucTxt === 'ACTIVO' ? '#198754' : '#dc3545';
        const colorDomi   = condDomiTxt   === 'HABIDO' ? '#198754' : '#dc3545';

        const detalles: string[] = [];
        if (estadoRucTxt) {
          detalles.push(
            `<b>Estado del RUC:</b> <span style="color:${colorEstado}; font-weight:bold;">${estadoRucTxt}</span>`
          );
        }
        if (condDomiTxt) {
          detalles.push(
            `<b>Condición de domicilio:</b> <span style="color:${colorDomi}; font-weight:bold;">${condDomiTxt}</span>`
          );
        }
        if (data.observaciones)   detalles.push(`<b>Observaciones:</b> ${data.observaciones}`);

        const html = `
          <div style="text-align:left; font-family: var(--app-font-family, Arial);">
            <p style="margin-bottom:${detalles.length ? '10px' : '0'};">${info.mensaje}</p>
            ${detalles.length ? `<div style="border-top:1px solid #dee2e6; padding-top:8px; font-size:0.9em; color:#555;">
              ${detalles.join('<br>')}
            </div>` : ''}
          </div>
        `;

        this.validaComprobante = info.valido;
        Swal.fire({
          title: info.titulo,
          html,
          icon: info.tipo,
          confirmButtonText: 'OK',
        });
      },
      error: (err) => {
        this.validaComprobante = false;     // Error de red → tampoco habilita
        const detalle = err?.error?.mensaje
                      || err?.error?.detalle
                      || err?.message
                      || 'No fue posible conectarse con el servicio de validación de SUNAT. Intente nuevamente en unos segundos.';
        Swal.fire({
          title: 'Error al validar el comprobante',
          text: detalle,
          icon: 'error',
          confirmButtonText: 'OK',
        });
      }
    });
  }

  parseNroDocumento(nroDocumento: string): { numeroSerie: string; numero: string } {
    const valor = (nroDocumento || '').trim();
    const idx = valor.indexOf('-');

    if (idx === -1) {
      return { numeroSerie: '', numero: valor };
    }

    const numeroSerie = valor.substring(0, idx).trim();
    const numero = valor.substring(idx + 1).trim();

    return { numeroSerie, numero };
  }

  formatFecha(fecha: NgbDateStruct): string {
    if (!fecha) {
      return '';
    }
    const dd = String(fecha.day).padStart(2, '0');
    const mm = String(fecha.month).padStart(2, '0');
    const yyyy = String(fecha.year);
    return `${dd}/${mm}/${yyyy}`;
  }
}

