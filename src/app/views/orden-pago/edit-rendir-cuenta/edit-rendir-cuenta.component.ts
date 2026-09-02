import { CommonModule, Location } from '@angular/common';
import { DIAS_ANTES_TOLERADOS, fechaMinimaAceptada } from '../../../shared/reglas-comprobante';
import { Component, ElementRef, NO_ERRORS_SCHEMA, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { NgbDatepickerConfig, NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import Tesseract from 'tesseract.js';
import { OrdenPago } from '../../../models/orden-pago';
import { CuentaDestino } from '../../../models/cuenta-destino';
import { OcrService } from '../../../services/ocr.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { PdfViewerComponent } from '../../../components/pdf-viewer/pdf-viewer.component';
import { normalizarArchivoCamara, comprimirImagenParaOcr } from '../../../shared/utils/mobile-file.util';
import { formatHttpError, errorHtml } from '../../../shared/utils/error-detail.util';
import { LoadingService } from '../../../services/loading.service';
import { Observable, Subscription, firstValueFrom } from 'rxjs';
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
import { parseNroComprobante, formatearNroDocumento, generarVariantesComprobante, LARGO_PADDING } from '../../../shared/utils/comprobante-numero.util';
import type { NroComprobante, VarianteComprobante } from '../../../shared/utils/comprobante-numero.util';
import { MaeRubro } from '../../../models/mae-rubro';
import { OrdenPagoDetDTO } from '../../../models/orden-pago-det';
import { AbonoService } from '../../../services/abono.service';
import { AbonoRendicion } from '../../../models/abono-rendicion';
import { MaeTipoGasto } from '../../../models/mae-tipo-gasto';
import { MaeDocumento } from '../../../models/mae-documento';
import { MaeMoneda } from '../../../models/mae-moneda';
import { MaeImpuesto } from '../../../models/mae-impuesto';
import { OrdenPagoDetProv } from '../../../models/orden-pago-det-prov';
import { DeviceService } from '../../../services/core-service/device.service';
import { DocumentoService } from '../../../services/documento.service';
import { OrdenPagoDetService } from '../../../services/orden-pago-det.service';
import { RendicionService } from '../../../services/rendicion.service';
import { RendicionDetDTO, RendicionImpuestoDTO } from '../../../models/rendicion';
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
    NgxCurrencyDirective,
    PdfViewerComponent
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
    private rendicionService: RendicionService,
    private ordenPagoDetProvService: OrdenPagoDetProvService,
    private configService: ConfigService,
    private config: NgbDatepickerConfig,
    private sanitizer: DomSanitizer,
    private sunatAnexosService: SunatAnexosService,
    private abonoService: AbonoService) {
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
  /**
   * URL cruda (blob:) o data URL del PDF en preview.
   *
   * `pdfPreviewUrl` es un `SafeResourceUrl` sanitizado para usar dentro de
   * iframes; el visor PDF.js NO lo acepta porque trabaja directamente con el
   * binario o la URL pura. Por eso exponemos el blob URL plano para pasarlo
   * al componente `<app-pdf-viewer>`.
   */
  pdfPreviewRawUrl: string | null = null;
  private pdfObjectUrl: string | null = null;

  // ─── Loading principal del proceso OCR (overlay full-screen) ────────
  /** True mientras el OCR está corriendo: muestra el overlay con timer. */
  ocrTimerActive: boolean = false;
  /** Segundos transcurridos desde que arrancó el OCR (0,1,2,…). */
  ocrTimerSeconds: number = 0;
  /** Handle del setInterval, para poder limpiarlo al terminar. */
  private ocrTimerHandle: any = null;
  /** Subtítulo principal del overlay. */
  ocrTimerLabel: string = 'Procesando comprobante…';
  /**
   * Fases del proceso. Cada una se va marcando como `done` o `active`
   * según el tiempo transcurrido. El usuario ve exactamente qué está
   * ocurriendo en cada momento.
   */
  ocrFases: { titulo: string; descripcion: string; estado: 'pending' | 'active' | 'done' }[] = [];

  /**
   * Suscripción activa al observable del OCR. Se conserva para que el
   * componente pueda saber si hay un OCR en curso (NO para cancelarlo).
   * Política del usuario: el OCR NUNCA se aborta, solo se puede minimizar.
   */
  private ocrSubscription: Subscription | null = null;

  /**
   * Cuando el usuario "minimiza" el overlay, el proceso OCR continúa y al
   * terminar se muestra un toast en lugar de cerrar visualmente algo que
   * ya no está visible. Esta bandera controla ese comportamiento.
   */
  ocrEnBackground: boolean = false;
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

  /**
   * Estado y condicion del RUC segun la ultima validacion de comprobante.
   *
   * Se guardan aparte porque `padronRuc` se reemplaza entero cada vez que se
   * consulta el padron, y esa consulta traeria de vuelta el dato viejo
   * pisando el que SUNAT dio en vivo.
   */
  private estadoRucDeSunat = '';
  private condicionRucDeSunat = '';
  validaComprobante: boolean = false;

  /**
   * El estadoCp que devolvio SUNAT (0..4), tal cual.
   *
   * `validaComprobante` dice si el comprobante sirve o no; esto dice POR QUE.
   * Se guarda con el comprobante para que despues se pueda explicar un
   * rechazo sin tener que volver a consultar SUNAT.
   */
  estadoSunat: string = '';

  /**
   * Ingreso manual del proveedor: se enciende cuando SUNAT no responde o
   * devuelve datos invalidos, o cuando el usuario lo fuerza con el boton.
   * En este modo los campos del proveedor se vuelven editables y el guardado
   * NO exige la validacion SUNAT (queda como "verificado manualmente").
   */
  ingresoManual: boolean = false;
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
   * true cuando la razon social que se muestra la puso el OCR y no el padron
   * de SUNAT. Sirve para que la respuesta oficial la pueda reemplazar sin
   * dudar, y para saber de donde salio el dato al depurar.
   */
  razonSocialDeOcr: boolean = false;

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

      // La cuenta a la que se devuelve sale de config.ini, no clavada en el
      // codigo: si manana cambia, se cambia el archivo.
      this.abonoAuxiliarBco = this.configService.get('ABONO_COD_AUXILIAR_BCO');
      this.abonoBanco = this.configService.get('ABONO_DES_BANCO');
      this.abonoCuenta = this.configService.get('ABONO_NUM_CUENTA_BCO');
      this.abonoMoneda = this.configService.get('ABONO_COD_MONEDA') || '01';
      this.abonoCuentaContable = this.configService.get('ABONO_COD_CUENTA_CONTABLE');
      // El ERP quiere el CODIGO (TES_FORMA_PAGO.COD_FORMA_PAGO, varchar(4)):
      // FCBK. La frase es solo para que el usuario lea algo.
      this.abonoCodFormaPago = this.configService.get('ABONO_COD_FORMA_PAGO');
      this.abonoFormaPago = this.configService.get('ABONO_DES_FORMA_PAGO');

      this.cuentasDestino = this.armarCuentasDestino();
      // Con una sola cuenta el combo no es una eleccion, es una confirmacion:
      // viene marcada. Si manana hay dos, arranca sin elegir para que nadie
      // deposite en la equivocada por no haber mirado.
      this.cuentaDestino = this.cuentasDestino.length === 1 ? this.cuentasDestino[0] : null;
    }
    this.isDesktop = this.deviceService.isDesktopDevice();
    const user = sessionStorage.getItem('user')
      ? JSON.parse(sessionStorage.getItem('user')!)
      : null;
    this.codEmpresa = user?.codEmpresa || '';

    // Va aca y no antes porque necesita codEmpresa, que se acaba de leer.
    this.cargarAbonos();

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
    // Regla de duplicado (obs. usuario): SOLO se valida por
    // RUC + serie + número de documento. NO se envía codDocumento (tipo)
    // porque en SUNAT la combinación RUC+serie+número es única.
    // codEmpresa/codSucursal se mandan como contexto multi-tenant del SQL.
    let wrapper: WrapperRequestDocumebtoExistente = new WrapperRequestDocumebtoExistente();
    wrapper.codAuxiliar = this.ordenPagoDet.codAuxiliar;
    wrapper.codEmpresa = this.orden.codEmpresa;
    wrapper.codSucursal = this.orden.codSucursal;
    wrapper.numOrden = this.orden.numOrden;
    // ✅ numRuc activa en el backend el modo "buscar por RUC + serie + número"
    // (sin filtrar por tipo de documento). Es el discriminador entre los
    // dos modos del SQL en DocumentoExistenteRepository.
    wrapper.numRuc = (this.ruc || '').trim();

    // Mismo parseo tolerante que usa la validacion SUNAT; a la BD va el
    // correlativo relleno a 15 (formato historico de la tabla).
    const docNro = parseNroComprobante(this.dataImagen.documentNumber);
    wrapper.numDocumento = docNro.ok ? docNro.numeroPadded : '';
    wrapper.numSerieDoc = docNro.serie;

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
        this.loadingService.hide();
      }
    );
  }

  getTiposGasto(codRubro: string): void {
    this.maestrosService.getTiposGasto(this.codEmpresa, codRubro).subscribe(
      (response: Response) => {
        const todosLosTipos: MaeTipoGasto[] = response.resultado || [];
        let filtro: string = "";
        if (this.orden.codCCostos?.startsWith('10')) {
          filtro = "010";
        } else {
          filtro = "0" + (this.orden.codCCostos?.substring(0, 1) ?? '') + (this.orden.codCCostos?.substring(2, 3) ?? '');
        }
        const filtrados = todosLosTipos.filter(tg => tg.desTipoGasto?.startsWith(filtro));
        // Si el filtro por centro de costos no deja ninguno (p. ej. centros
        // administrativos como 19901001, cuyo prefijo no matchea ningun tipo),
        // se muestran TODOS para que la orden se pueda rendir igual, en vez de
        // quedar sin opciones. Antes esto ademas reventaba en tiposGasto[0].
        this.tiposGasto = filtrados.length > 0 ? filtrados : todosLosTipos;
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
        this.ordenPagoDet.codTipoGasto = this.tiposGasto.length > 0 ? this.tiposGasto[0].codTipoGasto : '';
        this.onChangeTipoGasto();
      },
      (error) => {
        console.error('Error al cargar tipos de gasto', error);
        this.loadingService.hide();
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
        // Documento por defecto: el que dice el config.ini
        // (COD_DOCUMENTO_GENERAL, normalmente FC = factura de compras). Antes
        // se tomaba this.documentos[0], que es el primero del catalogo por
        // orden alfabetico: por eso arrancaba en "ANTICIPO CLIENTE", que ni
        // siquiera tiene codigo SUNAT y hacia fallar la validacion.
        const codPorDefecto = this.configService.get('COD_DOCUMENTO_GENERAL');
        this.documentoSeleccionado =
          filtrados.find(d => d.codDocumento === codPorDefecto) ?? filtrados[0];

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
  /**
   * Codigos SUNAT que NO se ofrecen para rendir un gasto.
   *   07 nota de credito, 08 nota de debito -> las registra contabilidad, no
   *      el empleado que rinde
   *   00 "otros" -> es un comodin del ERP, no un comprobante real
   */
  private readonly COD_SUNAT_EXCLUIDOS = ['00', '07', '08'];

  /**
   * Deja en el selector solo los documentos que sirven para sustentar un
   * gasto rendido.
   *
   * El maestro viene de MAE_DOCUMENTO, que es el catalogo del ERP contable:
   * trae letras, pagares, cheques, anticipos, notas de contabilidad y demas
   * instrumentos que no son comprobantes de pago. El filtro anterior solo
   * quitaba los que decian VENTA, asi que todo eso quedaba a la vista.
   *
   * Criterio: tiene que tener COD_SUNAT —o sea, ser un comprobante que SUNAT
   * reconoce— y no ser nota de credito/debito ni documento de venta.
   */
  private filtrarDocumentosCompra(docs: MaeDocumento[]): MaeDocumento[] {
    if (!docs || !docs.length) return [];

    const norm = (v: string | undefined | null): string => {
      if (!v) return '';
      return v.toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
    };

    return docs.filter(d => {
      if (!d?.codDocumento || !d?.desDocumento) return false;

      // 1. Tiene que ser un comprobante reconocido por SUNAT.
      const codSunat = (d.codSunat || '').trim();
      if (!codSunat) return false;
      if (this.COD_SUNAT_EXCLUIDOS.includes(codSunat)) return false;

      // 2. Fuera los de venta y exportacion (esta pantalla es de gastos).
      //
      //    Con una salvedad importante, porque el nombre del ERP engania:
      //    "BOLETAS DE VENTAS" (COD_SUNAT 03) es el comprobante que le dan al
      //    empleado en un restaurante o una tienda. "Venta" ahi describe el
      //    documento, no una operacion de la empresa. Es el caso mas comun de
      //    una rendicion, asi que las boletas se conservan siempre.
      const desc = norm(d.desDocumento);
      const esBoletaDeVenta = codSunat === '03';
      const esVenta = /\b(VENTA|VENTAS|VENT|EXPORTACI[OÓ]N|EXPORTACION|EXP)\b/.test(desc);
      const esCompra = /\b(COMPRA|COMPRAS)\b/.test(desc);
      if (esVenta && !esCompra && !esBoletaDeVenta) return false;

      // 3. Fuera las notas de credito y debito por descripcion, por si alguna
      //    quedo con un COD_SUNAT distinto en el maestro.
      if (/\bNOTA\s+(DE\s+)?(CREDITO|DEBITO)\b/.test(desc)) return false;

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
        const tipoCambioStorage = sessionStorage.getItem('tipocambio');
        this.ordenPagoDet.tipCambio = tipoCambioStorage
          ? JSON.parse(tipoCambioStorage).impVenta ?? 1
          : 1;

        // El importe NO se vuelve a tomar del OCR si el usuario ya puso uno.
        //
        // getImpuestos() corre cada vez que cambia el tipo de documento, y
        // antes pisaba `this.total` con lo que habia leido el escaneo: el
        // usuario escribia el monto, tocaba el combo, y se le borraba. En
        // ingreso manual —donde el OCR no leyo nada y `amount` vale '0'—
        // eso significaba guardar cero.
        //
        // Solo se siembra desde el OCR cuando todavia no hay importe.
        if (!this.hayImporte()) {
          this.total = this.aNumero(this.dataImagen.amount);
        }

        this.recalcularImportes();
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
    this.programarValidacionSunat();
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

    this.programarValidacionSunat();

    // Carga de anexos: solo cuando ya hay 11 dígitos válidos, con debounce
    // de 500ms para evitar spammear al backend si el usuario aún tipea.
    if (this._rucDebounce) clearTimeout(this._rucDebounce);
    if (/^\d{11}$/.test(r)) {
      this._rucDebounce = setTimeout(() => {
        this.cargarAnexosDelRuc(r, { silencioso: true });
      }, 500);
    }
  }

  /**
   * Al salir del campo "Nro. Documento" se normaliza lo que el usuario escribio
   * al formato interno SERIE-000000000000001. Acepta "f002 11092", "F00211092",
   * "F002 N° 11092", etc. Si no se puede interpretar, se respeta lo tipeado
   * (solo en mayusculas) para no borrarle el dato.
   */
  changeNumDocumento() {
    const anterior = this.dataImagen.documentNumber ?? '';
    const normalizado = formatearNroDocumento(
      anterior,
      this.devolverDocumento(this.codDocumentoGeneral),
    );
    this.dataImagen.documentNumber = normalizado;

    // Si cambio el numero, la validacion previa contra SUNAT ya no sirve.
    if (normalizado !== anterior) {
      this.validaComprobante = false;
    }
    this.programarValidacionSunat();
  }

  onMonedaChange() {
    this.programarValidacionSunat();
  }

  private handleRucResponse(response: Response, skipRule = false): void {
    if (!response || response.error !== 0) {
      this.hasValidRules = false;
      this.hasValidState();
      return;
    }
    const razonProvisional = this.razonSocialDeOcr
      ? (this.padronRuc?.razonSocial || '').trim()
      : '';

    this.padronRuc = response.resultado;

    // El dato del comprobante SOLO PUEDE MEJORAR el estado, nunca empeorarlo.
    //
    // Las dos fuentes envejecen, cada una por su lado: la ficha puede no
    // haberse releido, y el servicio de comprobantes no conoce los RUC
    // nuevos —al 20612227242, inscrito el 31/07/2026, le devolvia codigo 11
    // (BAJA DE OFICIO) mientras la ficha decia ACTIVO—.
    //
    // La asimetria es deliberada: una fuente desactualizada puede probar que
    // algo esta ACTIVO, porque lo vio activo. No puede probar lo contrario,
    // porque su silencio tambien significa "no lo conozco". Antes esto pisaba
    // en las dos direcciones y por eso marcaba de baja a proveedores sanos.
    if (this.padronRuc) {
      if (this.esActivo(this.estadoRucDeSunat) && !this.esActivo(this.padronRuc.estado)) {
        this.padronRuc.estado = this.estadoRucDeSunat;
      }
      if (this.esHabido(this.condicionRucDeSunat) && !this.esHabido(this.padronRuc.condicion)) {
        this.padronRuc.condicion = this.condicionRucDeSunat;
      }
    }

    // El padron es la fuente oficial: su razon social reemplaza a la del OCR.
    // Pero si el padron no la trae, se conserva la que ya habia leido el OCR
    // en vez de dejar el campo vacio.
    if (!(this.padronRuc?.razonSocial || '').trim() && razonProvisional) {
      this.padronRuc.razonSocial = razonProvisional;
    } else {
      this.razonSocialDeOcr = false;
    }

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

    // La ficha de e-consultaruc trae la direccion entera; el padron reducido
    // la traia en piezas y habia que rearmarla. Si viene armada se usa tal
    // cual: rearmar lo ya armado solo puede empeorarlo.
    const completa = (data?.direccion || '').trim();
    if (completa) {
      return completa;
    }

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

    // El padron no le dice NADA al usuario, y por eso ya no se le avisa.
    //
    // Historia de este metodo: primero abria un dialogo que habia que cerrar
    // en cada subida, despues quedo como toast mas aviso en linea. Las dos
    // versiones molestaban por lo mismo: el padron hoy responde 302 siempre,
    // asi que el aviso salta SIEMPRE, y termina siendo ruido que el usuario
    // aprende a ignorar — con lo cual tampoco sirve el dia que avise de algo
    // real.
    //
    // Ademas no aporta: el padron solo trae estado y condicion del RUC, y la
    // validacion del comprobante contra SUNAT —que corre sola al terminar el
    // escaneo— devuelve esos mismos datos de una fuente mas confiable. La
    // razon social y la direccion ya vienen del OCR.
    //
    // Queda solo en la consola, que es donde sirve para diagnosticar.
    console.warn('[padron RUC] no se pudo consultar', {
      status: error?.status,
      url: error?.url,
      detalle: error?.error,
    });

    this.hasValidRules = false;
    this.hasValidState();

    // SUNAT no respondio: se habilita el ingreso manual para no bloquear la
    // rendicion. El usuario completa los datos del proveedor a mano — pero si
    // el OCR ya leyo la razon social, se queda como esta y no hay nada que
    // completar.
    this.ingresoManual = true;

    const razonOcr = (this.dataImagen?.issuerName || '').trim();
    if (razonOcr && !(this.padronRuc?.razonSocial || '').trim()) {
      this.padronRuc.razonSocial = razonOcr;
      this.razonSocialDeOcr = true;
      console.info('[padron RUC] se conserva la razon social leida por el OCR:', razonOcr);
    }
  }

  async onSelectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const fileRaw = input.files[0];

    // 1) Renombrar de forma segura (importante para celular: el File de
    //    cámara suele venir con "image.jpg" o ruta absoluta).
    let file = normalizarArchivoCamara(fileRaw, 'rendir');

    // 2) Si es imagen, comprimir antes de enviar al OCR.
    //    Las fotos de celular suelen pesar 4-8 MB; comprimimos a ~1 MB
    //    máximo manteniendo 1600 px de lado largo. PaddleOCR funciona
    //    excelente a esa resolución y el upload + procesamiento se
    //    reduce a la mitad o más.
    const tamanoOriginal = file.size;
    file = await comprimirImagenParaOcr(file);
    if (file.size !== tamanoOriginal) {
      console.info(`[rendir-cuenta] imagen comprimida: ${(tamanoOriginal/1024).toFixed(0)} KB → ${(file.size/1024).toFixed(0)} KB`);
    }
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
    // Cronómetro visible: el usuario ve cuánto tarda el OCR.
    this.iniciarTimerOcr(enhance
      ? 'Mejorando imagen y reprocesando…'
      : 'Procesando comprobante…');

    // Reset de la bandera de background — overlay arranca visible.
    this.ocrEnBackground = false;

    // ⚠ Sin `timeout()` ni `takeUntil()`: política del usuario.
    // El OCR NO se cancela ni se aborta automáticamente; siempre se
    // espera la respuesta del servidor, por más que tarde.
    //
    // Usamos `uploadFileWithProgress` (en lugar de `uploadFile`) para
    // recibir los HttpEvents (UploadProgress, ResponseHeader, Response)
    // y avanzar las fases del overlay por momentos REALES:
    //   - mientras sube      → "Subiendo archivo" activo
    //   - subida completa    → "Subiendo archivo" ✓, "Aplicando OCR" activo
    //   - respuesta empieza  → (no cambia: el server aún arma JSON)
    //   - respuesta completa → "Aplicando OCR" ✓, mapeo de datos
    this.ocrSubscription = this.ocrService.uploadFileWithProgress(file, enhance)
      .subscribe({
      next: (event: any) => {
        // ─── A) Evento de progreso de subida ─────────────────────────
        if (event.type === HttpEventType.UploadProgress) {
          if (event.total) {
            const pct = Math.round((event.loaded / event.total) * 100);
            // Mostramos el % en la descripción de la fase 0 para que el
            // usuario vea la subida avanzar (importante con imágenes
            // grandes desde celular en red lenta).
            const fSubida = this.ocrFases[EditRendirCuentaComponent.FASE_SUBIDA];
            if (fSubida && fSubida.estado === 'active') {
              fSubida.descripcion = `Enviando el comprobante al servidor… (${pct}%)`;
            }
          }
          // Subida 100% completa: avanzamos a la fase "Aplicando OCR".
          // El server seguirá procesando hasta el HttpResponse final.
          if (event.total && event.loaded === event.total) {
            this.marcarFaseCompletada(EditRendirCuentaComponent.FASE_SUBIDA);
            // Mensaje de la fase OCR — útil cuando es imagen oscura/flash.
            const fOcr = this.ocrFases[EditRendirCuentaComponent.FASE_OCR];
            if (fOcr) {
              fOcr.descripcion = 'El servidor está reconociendo el texto. Puede tardar más en imágenes oscuras o con flash.';
            }
          }
          return;
        }

        // ─── B) Inicio de respuesta del servidor ─────────────────────
        if (event.type === HttpEventType.ResponseHeader) {
          // El server ya empezó a contestar — confirmamos las dos
          // primeras fases por si UploadProgress no llegó al 100% claro.
          this.marcarFaseCompletada(EditRendirCuentaComponent.FASE_SUBIDA);
          this.marcarFaseCompletada(EditRendirCuentaComponent.FASE_OCR);
          return;
        }

        // ─── C) Respuesta completa ───────────────────────────────────
        if (event.type !== HttpEventType.Response) {
          return; // otros eventos (DownloadProgress, Sent) — ignoramos
        }
        const response: any = event.body;

        // ✓ Llegó el body → garantizamos que fases 0 y 1 estén done.
        this.marcarFaseCompletada(EditRendirCuentaComponent.FASE_SUBIDA);
        this.marcarFaseCompletada(EditRendirCuentaComponent.FASE_OCR);

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

        // ✓ Datos del comprobante mapeados al formulario.
        this.marcarFaseCompletada(EditRendirCuentaComponent.FASE_DATOS);

        if (isValidDoc) {
          this.onGetDatosRuc();
        }

        // Si el overlay fue minimizado mientras el OCR procesaba en
        // background, avisamos al usuario con un toast — porque el
        // overlay ya no está visible para mostrar las fases.
        if (this.ocrEnBackground) {
          this.toastOcrListo();
        }
      },
      error: (err) => {
        console.error('[rendir-cuenta] OCR error:', err);
        this.detenerTimerOcr();
        this.ocrSubscription = null;
        const fueBackground = this.ocrEnBackground;
        this.ocrEnBackground = false;

        // Si el usuario ya minimizó el overlay, NO bloqueamos con un Swal
        // grande — mostramos un toast de error y log en consola.
        if (fueBackground) {
          this.toastOcrError(err);
          return;
        }

        // Si el overlay seguía visible, mostramos el detalle completo
        // del error para diagnosticar (sobre todo en móvil sin DevTools).
        const b = formatHttpError(err, 'OCR /ocr/scan al subir comprobante');
        Swal.fire({
          icon: 'error',
          title: b.title,
          html: errorHtml(b),
          width: 600,
          confirmButtonText: 'Entendido',
        });
      },
      complete: () => {
        this.detenerTimerOcr();
        this.ocrSubscription = null;
        this.ocrEnBackground = false;
      }
    });
  }

  /**
   * Oculta el overlay del OCR pero NO cancela la petición:
   * el observable sigue suscrito y, cuando responda, se mapea al
   * formulario y se muestra un toast informativo.
   *
   * Llamado desde el botón "Continuar trabajando" del overlay.
   */
  minimizarOcr(): void {
    console.info('[rendir-cuenta] OCR minimizado — sigue procesando en background');
    this.ocrEnBackground = true;
    this.ocrTimerActive = false;        // oculta visualmente el overlay
    // ⚠ NO llamamos `detenerTimerOcr()` porque queremos que el cronómetro
    // siga contando hasta que llegue la respuesta real del servidor.
  }

  /** Toast verde de éxito al terminar el OCR en background. */
  private toastOcrListo(): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Comprobante procesado',
      text: 'Los datos del OCR se cargaron en el formulario.',
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
    });
  }

  /** Toast rojo de error al fallar el OCR en background. */
  private toastOcrError(err: any): void {
    const b = formatHttpError(err, 'OCR en background');
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'El OCR falló',
      text: b.summary,
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
    });
  }

  private setPdfPreview(file: File): void {
    this.clearPdfPreview();
    this.pdfObjectUrl = URL.createObjectURL(file);
    this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl);
    this.pdfPreviewRawUrl = this.pdfObjectUrl; // string crudo para <app-pdf-viewer>
    this.showPdfPreview = true;
  }

  private clearPdfPreview(): void {
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
    }
    this.pdfObjectUrl = null;
    this.pdfPreviewUrl = null;
    this.pdfPreviewRawUrl = null;
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
      // OJO: la letra que detecta el OCR sirve para PRESELECCIONAR el tipo,
      // NO para recortar el combo.
      //
      // Antes aca se hacia `this.documentos = filtrar por primera letra`, y el
      // selector quedaba con lo poco que compartiera esa letra: con un tipo
      // detectado como "N" el usuario veia solo INVOICE, sin manera de elegir
      // FACTURA DE COMPRAS. En ingreso manual era peor todavia, porque el
      // recorte quedaba puesto de un escaneo anterior.
      //
      // El combo siempre muestra el catalogo completo de comprobantes que
      // sustentan gasto; abajo se elige cual viene marcado por defecto.
      this.documentos = this.documentosGeneral;

      // ───── 1) Auto-selección por defecto según tipo detectado ────────
      // Regla de negocio (obs. usuario):
      //   - Cualquier FACTURA del proveedor → "FACTURA DE COMPRA"
      //   - Cualquier BOLETA del proveedor → "BV POR COMPRAS"
      // Esta selección tiene PRIORIDAD sobre `findBestDocumentMatch` para
      // que el comportamiento sea predecible y siempre el mismo, sin
      // importar variantes ortográficas o palabras extras en el OCR.
      const porDefecto = this.seleccionPorDefectoDocumento(this.dataImagen.documentType);

      // ───── 2) Fallback al mejor match por palabras clave ─────────────
      // Solo se invoca si la selección por defecto no encontró candidato
      // exacto en el catálogo (ej. otras letras de tipo como 'N', 'G',…).
      const mejor = porDefecto || this.findBestDocumentMatch(
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

    // Numero de comprobante: primero se intenta con lo que devolvio el OCR y,
    // si eso no da serie+numero, se rastrilla el texto crudo completo. Asi un
    // "FOO2 - OOOO11O92" o un "F002\n11092" mal cortado igual se recupera.
    const tipoDocDetectado = this.devolverDocumento(this.codDocumentoGeneral);
    let docOcr = parseNroComprobante(detected.documentNumber, tipoDocDetectado);
    if (!docOcr.ok && detected?.rawText) {
      const porTexto = parseNroComprobante(detected.rawText, tipoDocDetectado);
      if (porTexto.ok) { docOcr = porTexto; }
    }

    if (docOcr.ok) {
      this.dataImagen.documentNumber = docOcr.formateado;
      if (docOcr.reparado || docOcr.advertencias.length) {
        console.info('[OCR] numero de comprobante interpretado', docOcr);
      }
    } else {
      // No se pudo interpretar: se deja lo que vino (o vacio) para que el
      // usuario lo complete a mano; el guard de validarComprobante lo avisa.
      this.dataImagen.documentNumber = (detected.documentNumber ?? '').toString().trim().toUpperCase();
      console.warn('[OCR] no se pudo interpretar el numero de comprobante',
        { valor: detected.documentNumber, advertencias: docOcr.advertencias });
    }

    this.dataImagen.issuerName = detected.issuerName;

    // El nombre del proveedor que se muestra sale de padronRuc.razonSocial, y
    // ese lo llena la consulta al padron. Si el padron no responde —hoy
    // devuelve 302— el campo quedaba vacio aunque el OCR SI hubiera leido el
    // nombre. Se usa el del OCR como valor provisional; si despues el padron
    // contesta, su razon social lo reemplaza por ser la fuente oficial.
    const razonOcr = (detected.issuerName || '').trim();
    if (razonOcr && !(this.padronRuc?.razonSocial || '').trim()
        && !this.pareceDireccion(razonOcr)) {
      this.padronRuc.razonSocial = razonOcr;
      this.razonSocialDeOcr = true;
    }

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

    // Si la fecha que leyó el OCR es anterior a la de la Orden de Pago se
    // avisa, pero no se bloquea nada: el comprobante se guarda observado.
    this.fechaDocValida = this.isFechaValida(this.modelIni);
    if (!this.fechaDocValida) {
      this.mostrarSwalFechaInvalida();
    }

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

    // Terminado el escaneo NO se consulta a SUNAT. El usuario revisa lo que
    // leyo el OCR —el tipo de documento, sobre todo— y recien entonces
    // aprieta Validar. Validar antes de esa revision consultaba con datos que
    // el propio usuario iba a corregir, y el rechazo que volvia no decia nada
    // sobre el comprobante.

    return true;
  }

  /**
   * Ya no se valida solo. La validacion contra SUNAT la dispara el usuario
   * con el boton Validar, y nada mas.
   *
   * Habia una revalidacion automatica con debounce colgada de los campos que
   * SUNAT necesita. Traia tres problemas: cambiar el foco del combo de tipo
   * de documento volvia a disparar la consulta una y otra vez; salia un aviso
   * incluso cuando el comprobante estaba bien, que el usuario no habia
   * pedido; y mientras el formulario estaba a medio llenar avisaba de datos
   * faltantes que el usuario justamente estaba por escribir.
   *
   * El metodo se conserva vacio porque lo llaman los campos del formulario;
   * dejarlo aca y no borrar seis llamadas mantiene el cambio acotado y hace
   * evidente que la decision fue deliberada y no un olvido.
   */
  programarValidacionSunat(): void {
    // Intencionalmente sin efecto: la validacion es manual.
  }

  /**
   * Indica si la fecha del documento cae dentro de la ventana aceptada.
   * Ya no bloquea el guardado: decide si se avisa que quedará observado.
   */
  fechaDocValida: boolean = true;

  /**
   * El día más antiguo que se acepta sin observar, o null si no hay OP.
   * Se llama distinto que la función importada para que no se confundan.
   */
  private get limiteDeFecha(): Date | null {
    return fechaMinimaAceptada(this.orden?.fecOrden);
  }

  isFechaValida(model: any): boolean {
    const limite = this.limiteDeFecha;
    if (!model || !limite) return false;

    // Convertir NgbDateStruct a Date
    const fechaModel = new Date(model.year, model.month - 1, model.day);
    fechaModel.setHours(0, 0, 0, 0);

    // Solo se mira hacia atrás: un comprobante posterior a la OP es lo normal.
    return fechaModel >= limite;
  }

  /**
   * Se dispara cuando el usuario cambia la fecha del documento.
   *
   * NO limpia lo que cargó el OCR y NO bloquea el guardado: si la fecha es
   * anterior a la de la orden de pago solo avisa, y el comprobante se guarda
   * observado. `fechaDocValida` se conserva porque la pantalla lo usa para
   * pintar el aviso, pero ya no lo lee isSaveDisabled().
   */
  changeDate(): boolean {
    const ok = this.isFechaValida(this.modelIni);
    this.fechaDocValida = ok;

    if (!ok) {
      // Se avisa una sola vez por fecha para no repetir el cartel en cada
      // tecla. NO tocamos validaComprobante ni dataImagen: SUNAT valida por
      // RUC, serie y número, que no dependen de esta fecha.
      this.mostrarSwalFechaInvalida();
      return false;
    }

    // Fecha OK: recalcular validaciones que dependan de la fecha (periodo
    // contable, etc.) sin destruir lo cargado.
    if (typeof this.onPeriodoDeclaracionChange === 'function') {
      try { this.onPeriodoDeclaracionChange(); } catch { /* noop */ }
    }
    this.programarValidacionSunat();
    return true;
  }

  /**
   * Muestra el Swal de "Fecha del documento inválida" con el detalle de
   * la fecha de la Orden de Pago. Centralizado en un solo método para
   * que se vea exactamente igual cuando:
   *   - El usuario cambia la fecha manualmente (changeDate)
   *   - El OCR cargó una fecha menor a la de la OP (mapDetectedData)
   */
  private mostrarSwalFechaInvalida(): void {
    const comoFecha = (d: Date) =>
      d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const limite = this.limiteDeFecha;
    const dias = DIAS_ANTES_TOLERADOS;

    Swal.fire({
      icon: 'warning',
      title: `El comprobante es de más de ${dias} días antes de la orden`,
      html: `Se aceptan comprobantes de hasta <b>${dias} días</b> antes de la ` +
            `Orden de Pago` +
            (limite ? `, o sea desde el <b>${comoFecha(limite)}</b>.` : '.') +
            `<br><br>Se puede guardar igual, pero queda <b>observado</b> y ` +
            `contabilidad lo va a revisar.` +
            `<br><br><em>Si la fecha está mal escrita, corregila ahora y la ` +
            `observación se levanta sola.</em>`,
      confirmButtonText: 'Entendido'
    });
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
          console.error('[rendir-cuenta] Error subiendo archivo:', err);
          // El backend Java guarda el archivo en disco; si falla (ruta inválida,
          // permisos, nombre inseguro), exponemos el detalle para móvil.
          const b = formatHttpError(err, 'Guardado de archivo en servidor (documentos/upload)');
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

      const docNro = parseNroComprobante(this.dataImagen.documentNumber);
      const numserie = docNro.serie;
      const numdoc = docNro.ok ? docNro.numeroPadded : '';

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

      // Solo se pisa si hay algo que poner. `this.codAuxiliar` se llena en
      // onGetDatosRuc buscando en la lista de proveedores, y queda vacío
      // cuando el RUC no está en esa lista —porque es nuevo, o porque está
      // registrado con otro tipo. onSaveAuxiliar ya resolvió el código en
      // ese caso: pisarlo con '' lo perdía y el comprobante viajaba sin
      // auxiliar, que es lo que después rebota contra la foránea del ERP.
      if (this.codAuxiliar) {
        this.ordenPagoDet.codAuxiliar = this.codAuxiliar;
      }

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
      // Los importes salen de `this.total` —lo que el usuario tiene en
      // pantalla— y no de lo que leyo el OCR. Antes se guardaba
      // `dataImagen.amount`, asi que un monto corregido a mano se veia bien
      // en la vista y viajaba mal a contabilidad. En ingreso manual, donde el
      // escaneo no leyo nada, ese valor era '0'.
      this.recalcularImportes();

      // El comprobante ya NO va directo a contabilidad. Entra a la antesala
      // de REGINA, donde el usuario todavia puede corregirlo o eliminarlo si
      // lo subio por error. Viaja al ERP recien cuando pre-cierra la
      // rendicion, y ahi si queda firme.
      this.guardarEnAntesala();
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

  /**
   * Guarda el comprobante en la antesala de REGINA.
   *
   * Tres pasos, en este orden:
   *
   *   1. se graba el comprobante y sus impuestos en una sola llamada;
   *   2. se sube el archivo escaneado, nombrado con el id que devolvio
   *      REGINA;
   *   3. se anota en el comprobante donde quedo el archivo.
   *
   * El nombre del archivo es el punto delicado. Contabilidad los nombra por
   * NUM_ITEM_OP, pero ese numero no existe todavia: lo asigna el ERP recien
   * al publicar. Por eso aca se usa el id de REGINA con una "R" adelante, y
   * el backend lo renombra al convenio del ERP durante el pre-cierre. Asi la
   * pantalla de contabilidad sigue encontrando los comprobantes como
   * siempre.
   */
  private guardarEnAntesala(): void {

    const comprobante = this.armarComprobanteDeRendicion();

    this.rendicionService.agregar(comprobante, this.usuarioActual()).subscribe({
      next: (guardado: RendicionDetDTO) => {

        this.nroItemOp = String(guardado.idRendDet ?? '');

        if (!this.selectedFile || !guardado.idRendDet) {
          this.onBack();
          return;
        }

        const wrapper: WrapperUploadDocumento = new WrapperUploadDocumento();
        wrapper.file = this.selectedFile;
        wrapper.anioPeriodo = this.orden.anoPeriodo;
        wrapper.mesPeriodo = this.orden.codPeriodo;
        wrapper.codEmpresa = this.orden.codEmpresa;
        wrapper.codSucursal = this.orden.codSucursal;
        wrapper.extension = this.getFileExtension(this.selectedFile);
        wrapper.numOrden = this.orden.numOrden;
        wrapper.numItem = `R${guardado.idRendDet}`;
        wrapper.tipoDocumento = this.ordenPagoDet.codDocumento;
        wrapper.serDocumento = this.ordenPagoDet.numSerieDoc;
        wrapper.numDocumento = this.ordenPagoDet.numDocumento;

        this.documentoService.uploadFile(wrapper).subscribe({
          next: (resp: any) => this.anotarArchivo(guardado, resp),
          error: (err: any) => {
            // El comprobante ya quedo guardado; lo que fallo es el archivo.
            // Se le dice al usuario exactamente eso, para que no vuelva a
            // cargar todo pensando que se perdio.
            console.error('[rendir-cuenta] fallo la subida del archivo:', err);
            Swal.fire({
              icon: 'warning',
              title: 'El comprobante se guardó, pero el archivo no subió',
              text: 'Puede volver a adjuntarlo editando el comprobante en la rendición.',
              confirmButtonText: 'Entendido',
            }).then(() => this.onBack());
          }
        });
      },
      error: (err: any) => this.avisarErrorAlGuardar(err)
    });
  }

  /**
   * Deja anotado en REGINA donde quedo el archivo escaneado.
   *
   * Es lo que permite despues borrarlo cuando el usuario elimina el
   * comprobante, y renombrarlo al publicar. Si esta anotacion falla, el
   * comprobante sigue estando bien: lo unico que se pierde es el vinculo con
   * el archivo, y eso no justifica hacerle repetir la carga al usuario.
   */
  private anotarArchivo(guardado: RendicionDetDTO, respuestaUpload: any): void {
    const archivo = respuestaUpload?.archivo;
    const ruta = respuestaUpload?.ruta;

    if (!archivo || !guardado.idRendDet) {
      this.onBack();
      return;
    }

    guardado.archivoNombre = archivo;
    guardado.archivoRuta = ruta;

    this.rendicionService.actualizar(guardado.idRendDet, guardado, this.usuarioActual())
      .subscribe({
        next: () => this.onBack(),
        error: (err: any) => {
          console.error('[rendir-cuenta] no se pudo anotar el archivo:', err);
          this.onBack();
        }
      });
  }

  /**
   * Arma el comprobante que se manda a la antesala.
   *
   * Son los mismos campos que antes viajaban al ERP —`this.ordenPagoDet`, ya
   * completo— mas lo que es propio de REGINA y hasta ahora se perdia: el RUC
   * y la razon social del emisor, la tasa de IGV que uso el usuario, que dijo
   * SUNAT y si el ingreso fue manual. Guardarlo permite explicar despues por
   * que un comprobante quedo como quedo, sin volver a consultar nada.
   */
  private armarComprobanteDeRendicion(): RendicionDetDTO {
    const comprobante: RendicionDetDTO = Object.assign(
      new RendicionDetDTO(), this.ordenPagoDet);

    comprobante.idRendDet = undefined;
    comprobante.numItemOp = undefined;      // lo asigna el ERP al publicar

    comprobante.rucEmisor = (this.ruc || '').trim();
    comprobante.razonSocialEmisor = this.nombreProveedor || undefined;
    comprobante.igvTasa = (this.igvPercent ?? 0) / 100;

    comprobante.indValidadoSunat = this.validaComprobante ? 'S' : 'N';
    comprobante.estSunat = this.estadoSunat || undefined;
    comprobante.fecValidaSunat = this.validaComprobante
      ? new Date().toISOString()
      : undefined;

    comprobante.indIngresoManual = this.ingresoManual ? 'S' : 'N';

    comprobante.impuestos = this.armarImpuestos();

    return comprobante;
  }

  /**
   * Los impuestos del comprobante, calculados del importe y del % de cada
   * uno.
   *
   * Ya no se guardan aparte: viajan dentro del comprobante y REGINA los
   * escribe en la misma operacion. Antes eran dos llamadas al backend, y
   * cuando la segunda fallaba el comprobante quedaba guardado sin su IGV —el
   * asiento salia mal armado y nadie se enteraba hasta el cierre del mes.
   *
   * NUM_CORRELATIVO y NUM_ITEM_OP no se llenan aca a proposito: son del ERP y
   * se calculan al publicar.
   */
  private armarImpuestos(): RendicionImpuestoDTO[] {
    const impuestos: RendicionImpuestoDTO[] = [];

    for (const impuesto of this.impuestos) {
      const tasa = 1 + ((impuesto.numPorcentaje ?? 0) / 100);

      const linea = new RendicionImpuestoDTO();
      linea.impImpuestoBase = (this.ordenPagoDet.impSoles ?? 0)
        - ((this.ordenPagoDet.impSoles ?? 0) / tasa);
      linea.impImpuestoSecun = (this.ordenPagoDet.impDolares ?? 0)
        - ((this.ordenPagoDet.impDolares ?? 0) / tasa);

      linea.anoProceso = sessionStorage.getItem('periodo_year') || undefined;
      linea.mesProceso = sessionStorage.getItem('periodo_month') || undefined;
      linea.codDocumento = this.ordenPagoDet.codDocumento;
      linea.codImpuesto = impuesto.codImpuesto;
      linea.indAfecto = 'S';
      linea.codSucLiq = this.orden.codSucursal || '001';
      linea.codSucProv = this.orden.codSucursal || '001';

      impuestos.push(linea);
    }

    return impuestos;
  }

  /** El id del usuario de la sesion, o undefined si no se pudo leer. */
  private usuarioActual(): number | undefined {
    try {
      const guardado = sessionStorage.getItem('user');
      if (!guardado) {
        return undefined;
      }
      const userId = JSON.parse(guardado)?.userId;
      return typeof userId === 'number' ? userId : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Explica por que no se pudo guardar.
   *
   * El backend responde 409 cuando la operacion no corresponde —la rendicion
   * ya se cerro, el comprobante esta duplicado— y en esos casos manda un
   * mensaje escrito para el usuario. Se lo muestra tal cual; inventar uno
   * generico seria peor.
   */
  private avisarErrorAlGuardar(err: any): void {
    console.error('[rendir-cuenta] error al guardar en la antesala:', err);

    const mensajeDelBackend = err?.error?.mensaje;

    if (err?.status === 409 && mensajeDelBackend) {
      Swal.fire({
        icon: 'warning',
        title: 'No se puede guardar',
        text: mensajeDelBackend,
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const b = formatHttpError(err, 'Guardado del comprobante en la rendición');
    Swal.fire({
      icon: 'error',
      title: b.title,
      html: errorHtml(b),
      width: 600,
      confirmButtonText: 'Entendido',
    });
  }

  // ---------------------------------------------------- devolucion de saldo

  /**
   * Los vouchers con los que el trabajador devuelve lo que le sobro.
   *
   * REGINA no genera ningun asiento: el cargo al trabajador ya existe en el
   * ERP desde que se emitio la orden —vive en la 1413, cuentas por cobrar al
   * personal— y lo cancela contabilidad al registrar el ingreso en Tesoreria.
   * Esto es la evidencia de que el deposito ocurrio.
   */
  abonos: AbonoRendicion[] = [];
  devuelto = 0;

  /**
   * Que pestana se esta viendo: el comprobante o la devolucion.
   *
   * Son dos tareas distintas sobre la misma orden, y separarlas evita que el
   * formulario de carga —que ya es largo— siga creciendo. Arranca siempre en
   * comprobante, que es a lo que la gente entra.
   */
  pestana: 'comprobante' | 'devolucion' = 'comprobante';

  /**
   * El interruptor del piloto. En false la devolucion queda apagada para
   * todos, admins incluidos, y la pestana se ve gris y no entra.
   *
   * Se apaga a mano cuando haga falta cortar la funcion sin volver atras el
   * despliegue: estamos en caliente y un deposito mal grabado es plata que
   * despues hay que ir a buscar al extracto.
   */
  private readonly DEVOLUCION_EN_PILOTO: boolean = true;

  /**
   * Si el que esta mirando puede usar la devolucion.
   *
   * Durante el piloto, solo admins. No es una decision de interfaz: los tres
   * cerrojos —entrar a la pestana, abrir el formulario y grabar— cuelgan de
   * aca, asi que un no-admin no graba un abono aunque llegue al metodo por
   * otra via. El *ngIf de la plantilla solo evita que lo vea.
   *
   * Ojo: sigue siendo una traba de navegador, no de servidor. El endpoint
   * POST /api/rendicion/abono existe y responde a cualquiera con sesion
   * valida. Si hiciera falta cerrarlo de verdad, hay que hacerlo en el API.
   */
  get devolucionHabilitada(): boolean {
    return this.DEVOLUCION_EN_PILOTO && this.esAdmin;
  }

  /** Unica puerta de entrada a la pestana, y esta cerrada con llave. */
  irADevolucion(): void {
    if (!this.devolucionHabilitada) { return; }
    this.pestana = 'devolucion';
  }

  /** Cuantos depositos vigentes hay, para el numerito de la pestana. */
  get abonosVigentes(): number {
    return this.abonos.filter(a => a.indAnulado !== 'S').length;
  }
  nuevoAbono: AbonoRendicion | null = null;
  guardandoAbono = false;

  /** La cuenta a la que se deposita: una sola y fija, sale de config.ini. */
  abonoBanco = '';
  abonoCuenta = '';
  abonoAuxiliarBco = '';
  abonoMoneda = '01';
  abonoCuentaContable = '';
  abonoFormaPago = '';
  abonoCodFormaPago = '';

  /**
   * Las cuentas a las que se puede devolver, y la elegida.
   *
   * Es una lista de una sola cuenta, pero lista al fin: el combo no cambia
   * cuando manana agreguen la de dolares.
   */
  cuentasDestino: CuentaDestino[] = [];
  cuentaDestino: CuentaDestino | null = null;

  /**
   * Arma la lista con lo que haya en config.ini.
   *
   * Si falta el banco o el numero de cuenta devuelve vacio a proposito. Antes
   * la pantalla mostraba "Depositar en , cuenta ()" con los huecos a la vista
   * y el boton de guardar igual funcionaba: se podia grabar un deposito sin
   * cuenta de destino. Ahora, sin cuenta completa, no hay nada que elegir y
   * no se graba.
   */
  private armarCuentasDestino(): CuentaDestino[] {

    const banco = (this.abonoBanco || '').trim();
    const cuenta = (this.abonoCuenta || '').trim();

    if (!banco || !cuenta) {
      console.warn('[abonos] config.ini sin ABONO_DES_BANCO / ABONO_NUM_CUENTA_BCO;'
                 + ' la devolucion queda sin cuenta de destino');
      return [];
    }

    const moneda = (this.abonoMoneda || '01').trim();

    return [{
      codAuxiliarBco: (this.abonoAuxiliarBco || '').trim(),
      desBanco: banco,
      numCuenta: cuenta,
      codMoneda: moneda,
      codCuentaContable: (this.abonoCuentaContable || '').trim(),
      codFormaPago: (this.abonoCodFormaPago || '').trim(),
      desFormaPago: (this.abonoFormaPago || '').trim(),
      etiqueta: `${banco} — ${cuenta} (${moneda === '01' ? 'S/' : 'US$'})`
    }];
  }

  // ---------------------------------------------------------------------
  // El avance de la rendicion: lo subido y lo que ya tiene contabilidad.
  //
  // NO tocan el saldo. El saldo se sigue calculando como siempre, contra lo
  // publicado al ERP; esto se muestra al lado para explicar por que puede
  // haber comprobantes cargados y el saldo intacto.
  // ---------------------------------------------------------------------

  /** El simbolo que corresponde a la moneda de la orden. */
  get simboloMoneda(): string {
    return this.monedaOrden === '01' ? 'S/' : 'US$';
  }

  /** Lo que lleva subido en REGINA, este publicado o no. */
  get subidoEnRegina(): number {
    return (this.monedaOrden === '01'
        ? this.orden?.impCargadoSoles : this.orden?.impCargadoDolares) ?? 0;
  }

  /** Lo que ya se publico al ERP. */
  get publicadoEnErp(): number {
    return (this.monedaOrden === '01'
        ? this.orden?.impRendidoSoles : this.orden?.impRendidoDolares) ?? 0;
  }

  get comprobantesSubidos(): number {
    return this.orden?.comprobantesCargados ?? 0;
  }

  /** Hay algo cargado que todavia no llego al ERP. Un centavo es redondeo. */
  get faltaPublicar(): boolean {
    return this.subidoEnRegina - this.publicadoEnErp > 0.01;
  }

  /**
   * '00' y '0' son el mismo codigo.
   *
   * El campo hermano estadoCp viene de UN digito en esta misma respuesta, asi
   * que comparar contra '00' a secas ya fallo una vez. Se normaliza.
   */
  /**
   * El estado que corresponde MOSTRAR, combinando la ficha y el comprobante.
   *
   * La ficha de e-consultaruc gana cuando dice ACTIVO: es el dato en vivo del
   * padron de SUNAT. El comprobante solo se muestra si la ficha no dice nada
   * o si tampoco lo da por activo. Misma asimetria que en handleRucResponse:
   * una fuente puede probar que algo esta activo, no que esta de baja.
   */
  private estadoEfectivo(
      delComprobante: { texto: string; color: string }): { texto: string; color: string } {

    const deLaFicha = (this.padronRuc?.estado || '').trim();

    if (this.esActivo(deLaFicha)) {
      return { texto: 'ACTIVO', color: '#198754' };
    }
    if (this.esActivo(delComprobante.texto)) {
      return { texto: 'ACTIVO', color: '#198754' };
    }
    // Ninguno lo da por activo: se muestra lo que diga la ficha, y si la
    // ficha no dice nada, lo del comprobante.
    return deLaFicha
        ? this.leerEstadoRuc(deLaFicha)
        : delComprobante;
  }

  /** Igual que estadoEfectivo, para la condicion de domicilio. */
  private condicionEfectiva(
      delComprobante: { texto: string; color: string }): { texto: string; color: string } {

    const deLaFicha = (this.padronRuc?.condicion || '').trim();

    if (this.esHabido(deLaFicha) || this.esHabido(delComprobante.texto)) {
      return { texto: 'HABIDO', color: '#198754' };
    }
    return deLaFicha
        ? this.leerCondicionDomicilio(deLaFicha)
        : delComprobante;
  }

  /** Un estado cuenta como ACTIVO si lo dice, venga como texto o como '00'. */
  private esActivo(v: string | undefined | null): boolean {
    const t = String(v ?? '').trim().toUpperCase();
    return t === 'ACTIVO' || t === '00' || t === '0';
  }

  /** Idem para el domicilio. */
  private esHabido(v: string | undefined | null): boolean {
    const t = String(v ?? '').trim().toUpperCase();
    return t === 'HABIDO' || t === '00' || t === '0';
  }

  private esCodigoCero(v: unknown): boolean {
    const t = String(v ?? '').trim();
    return t === '0' || t === '00';
  }

  /**
   * Los estados del RUC segun SUNAT, por su codigo.
   *
   * El color no es decorativo, dice que hacer:
   *   verde  ACTIVO, se puede operar
   *   ambar  situaciones reversibles —el RUC puede volver a estar activo—
   *   rojo   bajas definitivas e inhabilitacion
   *
   * Ojo: los codigos NO son correlativos (00, 01, 02, 03, 10, 11, 22) y la
   * numeracion no ordena por gravedad: 03 es una suspension temporal y 10 es
   * una baja definitiva. Por eso el mapa es explicito y no un rango.
   */
  private static readonly ESTADOS_RUC: { [codigo: string]: { texto: string; color: string } } = {
    '00': { texto: 'ACTIVO',                  color: '#198754' },
    '01': { texto: 'BAJA PROVISIONAL',        color: '#b45309' },
    '02': { texto: 'BAJA PROV. POR OFICIO',   color: '#b45309' },
    '03': { texto: 'SUSPENSIÓN TEMPORAL',     color: '#b45309' },
    '10': { texto: 'BAJA DEFINITIVA',         color: '#dc3545' },
    '11': { texto: 'BAJA DE OFICIO',          color: '#dc3545' },
    '22': { texto: 'INHABILITADO-VENT.ÚNICA', color: '#dc3545' },
  };

  /**
   * La condicion de domicilio, por su codigo.
   *
   * Tiene CINCO valores, no dos. El codigo hacia
   *     condDomiRuc === '00' ? 'HABIDO' : 'NO HABIDO'
   * y con eso un PENDIENTE o un POR VERIFICAR —que no son un problema— se
   * mostraban en rojo como NO HABIDO, que si lo es. El mismo error que el
   * estado del RUC, en el campo de al lado.
   *
   * Fuente: manual de Consulta Integrada de Validez del CdP de SUNAT.
   */
  private static readonly CONDICIONES_DOMI: { [codigo: string]: { texto: string; color: string } } = {
    '00': { texto: 'HABIDO',        color: '#198754' },
    '09': { texto: 'PENDIENTE',     color: '#6c757d' },
    '11': { texto: 'POR VERIFICAR', color: '#6c757d' },
    '12': { texto: 'NO HABIDO',     color: '#dc3545' },
    '20': { texto: 'NO HALLADO',    color: '#b45309' },
  };

  /** Igual que el estado del RUC: se reconoce, o se admite que no. */
  private leerCondicionDomicilio(valor: unknown): { texto: string; color: string } {

    const crudo = String(valor ?? '').trim();
    if (!crudo) {
      return { texto: '', color: '#6c757d' };
    }

    const codigo = /^\d{1,2}$/.test(crudo) ? crudo.padStart(2, '0') : crudo;
    const conocido = EditRendirCuentaComponent.CONDICIONES_DOMI[codigo];
    if (conocido) {
      return conocido;
    }

    const t = codigo.toUpperCase();
    for (const c of Object.values(EditRendirCuentaComponent.CONDICIONES_DOMI)) {
      if (t === c.texto) {
        return c;
      }
    }

    console.warn('[sunat] condDomiRuc no reconocido:', crudo);
    return { texto: `no reconocido (${crudo})`, color: '#6c757d' };
  }

  /**
   * El estado del RUC, en las palabras que usa SUNAT.
   *
   * Antes esto era estadoRuc === '00' ? 'ACTIVO' : 'NO ACTIVO', y el else
   * hacia de catalogo: cualquier valor inesperado se mostraba en rojo como
   * "NO ACTIVO", un estado que SUNAT NO TIENE. Le decia a la gente que un
   * proveedor estaba de baja cuando estaba perfecto.
   *
   * Acepta el codigo con o sin el cero de adelante —el campo hermano estadoCp
   * viene de UN digito en esta misma respuesta, asi que comparar contra '00'
   * a secas ya fallo una vez—, y tambien el texto por si SUNAT lo manda asi.
   *
   * Un codigo que no este en la tabla se muestra tal cual y en gris: no saber
   * no es una mala noticia, es la ausencia de una noticia. El console.warn
   * deja el valor para poder agregarlo cuando aparezca.
   */
  private leerEstadoRuc(valor: unknown): { texto: string; color: string } {

    const crudo = String(valor ?? '').trim();
    if (!crudo) {
      return { texto: '', color: '#6c757d' };
    }

    // '1' y '01' son el mismo codigo. Solo se rellena si es numerico: un
    // texto como "ACTIVO" no se toca.
    const codigo = /^\d{1,2}$/.test(crudo) ? crudo.padStart(2, '0') : crudo;

    const conocido = EditRendirCuentaComponent.ESTADOS_RUC[codigo];
    if (conocido) {
      return conocido;
    }

    // Vino como texto: se busca por el nombre, sin tildes ni mayusculas.
    const t = codigo.toUpperCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const est of Object.values(EditRendirCuentaComponent.ESTADOS_RUC)) {
      const nombre = est.texto.toUpperCase()
                              .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (t === nombre) {
        return est;
      }
    }
    if (t === 'ACTIVO') {
      return EditRendirCuentaComponent.ESTADOS_RUC['00'];
    }

    console.warn('[sunat] estadoRuc no reconocido:', crudo);
    return { texto: `no reconocido (${crudo})`, color: '#6c757d' };
  }

  /** La moneda de la orden. Si no viniera, se asume soles, que es el 99%. */
  get monedaOrden(): string {
    return (this.orden?.codMoneda || '01').trim();
  }

  /**
   * Una orden en dolares no se puede devolver todavia: la unica cuenta
   * configurada es la corriente en soles, y depositar dolares ahi obliga a
   * contabilidad a rearmar el tipo de cambio a mano.
   */
  get ordenEnOtraMoneda(): boolean {
    return this.monedaOrden !== '01';
  }

  get hayCuentaDestino(): boolean {
    return this.cuentasDestino.length > 0;
  }

  /** Las tres condiciones para poder cargar un deposito, juntas. */
  get puedeRegistrarDeposito(): boolean {
    return this.devolucionHabilitada && this.hayCuentaDestino && !this.ordenEnOtraMoneda;
  }

  /**
   * Por ahora la seccion es solo para admins.
   *
   * Estamos en caliente y el circuito todavia no esta cerrado del otro lado:
   * si un trabajador ve el bloque, carga su voucher y da por hecho que alguien
   * lo esta mirando. Cuando contabilidad este siguiendo los abonos, se abre.
   */
  get esAdmin(): boolean {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || '{}');
      return !!u.userAdmin;
    } catch {
      return false;
    }
  }

  /** Lo que falta devolver: el saldo de la OP menos lo ya abonado. */
  get saldoPorDevolver(): number {
    const saldo = (this._saldoBaseSoles || 0) - (this.devuelto || 0);
    return saldo > 0 ? Math.round(saldo * 100) / 100 : 0;
  }

  private cargarAbonos(): void {
    if (!this.orden?.numOrden) { return; }
    this.abonoService
      .listar(this.codEmpresa, this.orden.codSucursal!, this.orden.numOrden!)
      .subscribe({
        next: r => {
          this.abonos = r.abonos || [];
          this.devuelto = r.devuelto || 0;
        },
        // Que no haya abonos no es un error que valga interrumpir la carga del
        // comprobante, que es a lo que el usuario vino.
        error: e => console.warn('[abonos] no se pudieron leer:', e)
      });
  }

  abrirNuevoAbono(): void {
    // Segundo cerrojo: aunque alguien llegara a la pestana por otra via, el
    // formulario no se abre mientras la devolucion este apagada, sin cuenta
    // configurada o con una orden en otra moneda.
    if (!this.puedeRegistrarDeposito) { return; }

    // Con una sola cuenta ya viene marcada; esto cubre el dia que haya dos y
    // el usuario abra el formulario sin haber elegido.
    const cta = this.cuentaDestino || this.cuentasDestino[0];

    const hoy = new Date().toISOString().slice(0, 10);
    this.nuevoAbono = {
      codEmpresa: this.codEmpresa,
      codSucursal: this.orden?.codSucursal || '',
      numOrden: this.orden?.numOrden || '',
      fecDeposito: hoy,
      fecMovimiento: hoy,
      codAuxiliarBco: cta.codAuxiliarBco,
      desBanco: cta.desBanco,
      numCuentaBco: cta.numCuenta,
      codFormaPago: cta.codFormaPago,
      codCuentaBco: cta.codCuentaContable,
      codMoneda: cta.codMoneda,
      // Se propone el saldo pendiente, que es lo que casi siempre se deposita.
      impSoles: this.saldoPorDevolver || undefined,
      numOperacion: '',
      glosa: `DEVOLUCION DE OP ${this.orden?.numOrden || ''}`
    };
  }

  cerrarNuevoAbono(): void {
    this.nuevoAbono = null;
  }

  /**
   * Al cambiar de cuenta en el combo hay que reescribir los datos bancarios
   * del abono en curso. Si no, se guarda el deposito con el banco de la
   * cuenta que estaba elegida al abrir el formulario: el error mas silencioso
   * posible, porque en pantalla se ve la cuenta correcta.
   */
  onCuentaDestinoCambia(): void {
    if (!this.nuevoAbono || !this.cuentaDestino) { return; }
    this.nuevoAbono.codAuxiliarBco = this.cuentaDestino.codAuxiliarBco;
    this.nuevoAbono.desBanco = this.cuentaDestino.desBanco;
    this.nuevoAbono.numCuentaBco = this.cuentaDestino.numCuenta;
    this.nuevoAbono.codFormaPago = this.cuentaDestino.codFormaPago;
    this.nuevoAbono.codCuentaBco = this.cuentaDestino.codCuentaContable;
    this.nuevoAbono.codMoneda = this.cuentaDestino.codMoneda;
  }

  guardarAbono(): void {
    // Tercer cerrojo, el que de verdad interesa: no se graba nada mientras la
    // devolucion este apagada, sin importar como se haya llegado hasta aca.
    if (!this.devolucionHabilitada) { return; }
    if (!this.nuevoAbono) { return; }

    if (!this.cuentaDestino) {
      Swal.fire({ icon: 'warning', title: 'Falta la cuenta de destino',
                  text: 'Elija la cuenta a la que se hizo el depósito.' });
      return;
    }
    // Ultima sincronizacion antes de mandar: lo que se guarda es la cuenta
    // que esta elegida ahora, no la que estaba al abrir el formulario.
    this.onCuentaDestinoCambia();

    const importe = Number(this.nuevoAbono.impSoles);
    if (!Number.isFinite(importe) || importe <= 0) {
      Swal.fire({ icon: 'warning', title: 'Falta el importe',
                  text: 'Indique cuánto se depositó.' });
      return;
    }
    if (!(this.nuevoAbono.numOperacion || '').trim()) {
      Swal.fire({ icon: 'warning', title: 'Falta el número de operación',
                  text: 'Es el dato con el que contabilidad ubica el depósito en el extracto.' });
      return;
    }

    this.guardandoAbono = true;
    const userId = this.usuarioId();

    this.abonoService.crear(this.nuevoAbono, userId).subscribe({
      next: r => {
        this.guardandoAbono = false;
        this.nuevoAbono = null;
        this.cargarAbonos();
        // El backend avisa si ese numero de operacion ya estaba cargado. Es un
        // aviso y no un rechazo: repartir un deposito entre dos ordenes repite
        // el numero de forma legitima.
        const repetido = (r?.mensaje || '').startsWith('La operacion');
        Swal.fire({
          toast: true, position: 'top-end',
          icon: repetido ? 'warning' : 'success',
          title: repetido ? 'Revise el número de operación' : 'Devolución registrada',
          text: repetido ? r.mensaje : '',
          showConfirmButton: repetido,
          timer: repetido ? undefined : 4000
        });
      },
      error: e => {
        this.guardandoAbono = false;
        const b = formatHttpError(e, 'Registro de la devolución');
        Swal.fire({ icon: 'error', title: b.title, html: errorHtml(b), width: 600 });
      }
    });
  }

  anularAbono(a: AbonoRendicion): void {
    if (!a.idRendAbono) { return; }
    Swal.fire({
      icon: 'question',
      title: '¿Anular esta devolución?',
      text: 'La fila queda registrada como anulada, con quién y cuándo. No se borra.',
      showCancelButton: true, confirmButtonText: 'Anular', cancelButtonText: 'Volver'
    }).then(res => {
      if (!res.isConfirmed) { return; }
      this.abonoService.anular(a.idRendAbono!, this.usuarioId()).subscribe({
        next: () => this.cargarAbonos(),
        error: e => {
          const b = formatHttpError(e, 'Anulación de la devolución');
          Swal.fire({ icon: 'error', title: b.title, html: errorHtml(b), width: 600 });
        }
      });
    });
  }

  private usuarioId(): number | undefined {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || '{}');
      return u.userId != null ? Number(u.userId) : undefined;
    } catch {
      return undefined;
    }
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

  /** El usuario fuerza el ingreso manual del proveedor. */
  activarIngresoManual(): void {
    this.ingresoManual = true;
    this.mensaje = '';

    // En manual el usuario elige todo: el combo tiene que ofrecer el catalogo
    // completo, sin el recorte que pudiera haber dejado un escaneo previo.
    this.documentos = this.documentosGeneral;
  }

  /** Vuelve al modo normal (validacion contra SUNAT). */
  desactivarIngresoManual(): void {
    this.ingresoManual = false;
  }

  /**
   * Motivos por los que Guardar esta deshabilitado, en texto para el usuario.
   *
   * Antes esto era una cadena de nueve `if` que devolvian true sin explicar
   * cual: el usuario veia el boton apagado con el formulario aparentemente
   * completo y no tenia como saber que faltaba. Ahora la lista es la unica
   * fuente: `isSaveDisabled()` es simplemente "hay motivos", y el mismo texto
   * se muestra en el tooltip y debajo del boton.
   */
  motivosParaNoGuardar(): string[] {
    const motivos: string[] = [];

    const docNum = (this.dataImagen.documentNumber || '').trim();
    const subTotal = Number(this.subTotal);
    const total = Number(this.total);

    if (!this.mesDeclaracion || !this.anioDeclaracion) {
      motivos.push('Falta elegir el mes y año de declaración.');
    }

    if (this.igvPercent === null || this.igvPercent === undefined
        || this.igvPercent < 0 || this.igvPercent > 100) {
      motivos.push('El % de IGV no es válido (debe estar entre 0 y 100).');
    }

    // En ingreso manual no se exige la validacion de SUNAT.
    if (!this.ingresoManual && !this.validaComprobante) {
      motivos.push('El comprobante todavía no fue validado por SUNAT.');
    }

    if (!this.selectedFile) {
      motivos.push('Falta cargar el archivo del comprobante.');
    }

    // Regla SUNAT: un RUC que empieza con 20 solo emite facturas.
    if (this.bloqueoTipoDoc) {
      motivos.push(this.mensajeTipoDoc
        || 'El tipo de documento no corresponde al RUC del proveedor.');
    }

    // La fecha anterior a la de la OP YA NO bloquea el guardado.
    //
    // El gasto existe igual y hay que rendirlo igual. Bloquearlo solo lograba
    // que el usuario corrigiera la fecha a mano para poder guardar, o sea que
    // el bloqueo producia el dato falso que pretendia evitar. Ahora entra, se
    // le avisa, y el backend lo marca observado con el motivo FECHA_PREVIA
    // para que contabilidad lo vea al revisar y decida.

    if (!docNum) {
      motivos.push('Falta el Nro. de Documento.');
    } else if (!this.isDocumentNumberValid(docNum)) {
      motivos.push(`El Nro. de Documento no se entiende: ${docNum}`);
    }

    if (!total) {
      motivos.push('El importe total está en cero.');
    }

    if (!subTotal) {
      motivos.push('El subtotal está en cero (se calcula del total y el % de IGV).');
    }

    // Las reglas del padron (this.validate) YA NO bloquean el guardado.
    //
    // Dos razones: el padron es una fuente informativa —estado y condicion del
    // RUC— y hoy ni siquiera responde (302 desde sai-web-utils); y sobre todo,
    // si SUNAT ya valido el comprobante contra RUC, serie, numero, fecha y
    // monto, esa es una comprobacion mas fuerte que la del padron. Bloquear
    // por el padron dejaba rendiciones correctas sin poder guardarse.
    // El aviso sigue visible en `this.mensaje`, debajo del proveedor.

    return motivos;
  }

  /** Texto para el tooltip del boton Guardar. */
  motivoGuardar(): string {
    const motivos = this.motivosParaNoGuardar();
    return motivos.length
      ? 'No se puede guardar todavía:\n• ' + motivos.join('\n• ')
      : 'Guardar la rendición';
  }

  isSaveDisabled(): boolean {
    return this.motivosParaNoGuardar().length > 0;
  }


  changeImporte(importe: Event | number) {
    const raw = typeof importe === 'number' ? importe : Number(importe as any);
    // Ignorar NaN: preservar el importe actual y no destruir el OCR.
    if (!Number.isFinite(raw)) { return; }
    this.total = raw;
    this.recalcularImportes();
    // Recalcular saldo con debounce (evita parpadeo y múltiples Swal seguidos).
    this.recalcularSaldos();
    // SUNAT valida por monto, asi que corregir el importe invalida la
    // consulta anterior y hay que volver a preguntar.
    this.programarValidacionSunat();
  }

  /** true si ya hay un importe cargado, venga del OCR o del usuario. */
  private hayImporte(): boolean {
    return Number.isFinite(this.total) && this.total > 0;
  }

  /** Number() que devuelve 0 ante vacio o texto, en vez de NaN. */
  private aNumero(valor: any): number {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Deriva subtotal, impuesto e importes del detalle a partir de `this.total`.
   *
   * `this.total` es la unica fuente de verdad del importe: es lo que el
   * usuario ve y edita. Antes cada lugar recalculaba por su cuenta —unos con
   * el % editable, otros con la suma de los impuestos del maestro— y al
   * guardar se leia directamente lo que habia leido el OCR, que podia ser
   * otro numero distinto del que estaba en pantalla.
   */
  private recalcularImportes(): void {
    const totalPorcentaje = 1 + ((this.igvPercent || 0) / 100);

    this.subTotal = totalPorcentaje > 0 ? this.total / totalPorcentaje : this.total;
    this.impuesto = this.total - this.subTotal;

    // El OCR queda sincronizado con lo que se ve. Lo que se guarda sale de
    // `this.total`, pero dejarlos distintos hace que la traza del escaneo
    // mienta sobre lo que termino en contabilidad.
    this.dataImagen.amount = String(this.total);

    const tipoCambio = this.ordenPagoDet.tipCambio ?? 1;
    if ((this.ordenPagoDet.codMoneda || this.orden?.codMoneda || '01') === '01') {
      this.ordenPagoDet.impSoles = this.total;
      this.ordenPagoDet.impDolares = tipoCambio ? this.total / tipoCambio : this.total;
    } else {
      this.ordenPagoDet.impDolares = this.total;
      this.ordenPagoDet.impSoles = this.total * tipoCambio;
    }

    this.ordenPagoDet.impImponSoles = totalPorcentaje > 0
      ? (this.ordenPagoDet.impSoles ?? 0) / totalPorcentaje
      : this.ordenPagoDet.impSoles;
    this.ordenPagoDet.impImponDolares = totalPorcentaje > 0
      ? (this.ordenPagoDet.impDolares ?? 0) / totalPorcentaje
      : this.ordenPagoDet.impDolares;
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
  /**
   * Selección por defecto del tipo de documento según la primera letra
   * del `documentType` detectado por OCR.
   *
   * Regla de negocio (observación del usuario):
   *   - F → "FACTURA DE COMPRA"   (cualquier tipo de factura del proveedor)
   *   - B → "BV POR COMPRAS"      (cualquier tipo de boleta del proveedor)
   *
   * Busca el match contra la descripción del catálogo (`desDocumento`)
   * usando inclusión de palabras clave normalizadas; así sigue funcionando
   * aunque la descripción exacta cambie a "Factura de Compras", "FACTURAS
   * DE COMPRA", etc.
   *
   * Devuelve `null` si no encuentra ningún documento que cumpla las
   * keywords — el llamador caerá al `findBestDocumentMatch` genérico.
   */
  private seleccionPorDefectoDocumento(documentType: string | undefined): MaeDocumento | null {
    if (!documentType) return null;
    const letra = documentType.toUpperCase().substring(0, 1);

    // Keywords mínimas que la descripción del documento debe contener
    // (todas y cada una). Orden de prioridad: la primera que matchea gana.
    let claves: string[][] = [];
    if (letra === 'F') {
      // Acepta "FACTURA DE COMPRA", "FACTURA DE COMPRAS", "FACTURAS DE COMPRA"
      claves = [['FACTURA', 'COMPRA']];
    } else if (letra === 'B') {
      // Acepta "BV POR COMPRAS", "BV POR COMPRA",
      //        "BOLETA POR COMPRAS", "BOLETA POR COMPRA",
      //        "BOLETA DE VENTA POR COMPRA"
      claves = [
        ['BV', 'COMPRA'],
        ['BOLETA', 'COMPRA'],
      ];
    } else {
      return null;
    }

    for (const grupo of claves) {
      const found = this.documentos.find(d => {
        const desc = this.normalize(`${d.desDocumento || ''} ${d.desCorta || ''}`);
        return grupo.every(k => desc.includes(k));
      });
      if (found) return found;
    }
    return null;
  }

  // ─── Loading principal del proceso OCR (overlay con timer y fases) ──

  // Índices fijos de cada fase, para usarlos como constantes legibles.
  private static readonly FASE_SUBIDA   = 0;
  private static readonly FASE_OCR      = 1;
  private static readonly FASE_DATOS    = 2;

  /**
   * Arranca el overlay de loading con cronómetro y fases REALES del
   * proceso. Reemplaza al `loadingService.show()` durante el OCR.
   *
   * Cada fase se marca por evento real (no por timeout):
   *   - Fase 0 "Subiendo archivo":   active al hacer .subscribe();
   *                                  done apenas llega el next().
   *   - Fase 1 "Aplicando OCR":      done con el next() (el server ya
   *                                  terminó de leer el comprobante).
   *   - Fase 2 "Identificando datos":done tras mapDetectedData.
   *
   * IMPORTANTE: la verificación de duplicado en BD (solo RUC + tipo +
   * serie + número) ocurre RECIÉN al hacer Guardar — no se reenvía la
   * imagen ni se reescanea. Por eso el overlay del OCR ya no incluye
   * esa fase: el usuario tiene el formulario disponible apenas termine
   * el mapeo y puede revisar/corregir antes de guardar.
   */
  private iniciarTimerOcr(label: string = 'Procesando comprobante…'): void {
    this.detenerTimerOcr(); // por si ya había uno corriendo
    this.ocrTimerSeconds = 0;
    this.ocrTimerLabel = label;
    this.ocrTimerActive = true;

    // Estado inicial de las fases
    this.ocrFases = [
      { titulo: 'Subiendo archivo',    descripcion: 'Enviando el comprobante al servidor.',          estado: 'active'  },
      { titulo: 'Aplicando OCR',       descripcion: 'Reconociendo el texto de la imagen.',           estado: 'pending' },
      { titulo: 'Identificando datos', descripcion: 'Extrayendo RUC, número, fechas y montos.',      estado: 'pending' },
    ];

    // Solo contador de tiempo total; las fases se manejan por evento.
    this.ocrTimerHandle = setInterval(() => {
      this.ocrTimerSeconds++;
    }, 1000);
  }

  /**
   * Marca una fase como `done` y activa la siguiente (si existe).
   * Se invoca desde puntos reales del flujo (next del OCR, fin de mapeo,
   * fin de validación), no por tiempo.
   */
  marcarFaseCompletada(idx: number): void {
    if (!this.ocrFases || idx < 0 || idx >= this.ocrFases.length) return;
    this.ocrFases[idx].estado = 'done';
    const siguiente = idx + 1;
    if (siguiente < this.ocrFases.length && this.ocrFases[siguiente].estado === 'pending') {
      this.ocrFases[siguiente].estado = 'active';
    }
  }

  /**
   * Detiene el cronómetro y marca TODAS las fases como completadas
   * (la animación final muestra los checks en verde antes de cerrar).
   */
  private detenerTimerOcr(): void {
    if (this.ocrTimerHandle) {
      clearInterval(this.ocrTimerHandle);
      this.ocrTimerHandle = null;
    }
    if (this.ocrFases?.length) {
      this.ocrFases.forEach(f => (f.estado = 'done'));
    }
    this.ocrTimerActive = false;
  }

  /** Formatea segundos como "00:42" para mostrar en el overlay. */
  formatOcrTimer(): string {
    const s = this.ocrTimerSeconds;
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }

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
    if (this.hayImporte()) {
      this.recalcularImportes();
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

  /**
   * El numero es valido si el parser tolerante logra sacar serie y correlativo.
   * (Antes se exigia el formato exacto SERIE-15 digitos, lo que rechazaba
   * numeros correctos escritos de otra forma.)
   */
  private isDocumentNumberValid(value: string): boolean {
    if (!value) return false;
    return parseNroComprobante(value).ok;
  }

  /**
   * Devuelve el documento del catalogo que esta seleccionado, buscando primero
   * en la lista filtrada y despues en el catalogo completo. Antes se hacia
   * `this.documentos.filter(...)[0].codSunat`, que revienta si la lista quedo
   * vacia por el filtro por tipo.
   */
  private getDocumentoSeleccionado(): MaeDocumento | undefined {
    const cod = this.codDocumentoGeneral;
    if (!cod) { return undefined; }
    return this.documentos.find(d => d.codDocumento == cod)
        ?? this.documentosGeneral.find(d => d.codDocumento == cod);
  }

  /**
   * Revisa TODO lo que la API de SUNAT exige, antes de salir a la red.
   *
   * SUNAT responde 422 con un solo campo por vez ("el campo 'numeroSerie' es
   * obligatorio", despues "el tipo de comprobante es incorrecto: null", etc.),
   * asi que sin esto el usuario descubre los errores de a uno y cada vuelta le
   * cuesta un viaje al servidor. Aca se juntan todos y se le muestran juntos.
   *
   * Devuelve la lista de lo que falta, en el orden en que conviene corregirlo.
   * Lista vacia = se puede validar.
   */
  private faltantesParaSunat(docNro: NroComprobante): string[] {
    const faltan: string[] = [];

    const rucConsultante = (sessionStorage.getItem('ruc') ?? '').trim();
    const rucProveedor = (this.ruc || '').trim();
    const doc = this.getDocumentoSeleccionado();
    const monto = Number(this.total);

    if (!/^\d{11}$/.test(rucConsultante)) {
      faltan.push('El <b>RUC de la empresa</b> no esta en la sesion (SUNAT lo exige como consultante). Vuelva a iniciar sesion.');
    }

    if (!rucProveedor) {
      faltan.push('Falta el <b>RUC del proveedor</b>.');
    } else if (!/^\d{11}$/.test(rucProveedor)) {
      faltan.push(`El <b>RUC del proveedor</b> no tiene 11 digitos (${rucProveedor}).`);
    }

    if (!doc) {
      faltan.push('No hay un <b>tipo de documento</b> seleccionado.');
    } else if (!(doc.codSunat || '').trim()) {
      faltan.push(`El documento <b>${doc.desDocumento || doc.codDocumento}</b> no tiene codigo SUNAT: `
        + 'no es un comprobante que SUNAT valide. Elija factura, boleta o nota de credito/debito.');
    }

    if (!docNro.serie && !docNro.numero) {
      faltan.push('No se pudo leer la <b>serie ni el numero</b> del comprobante.');
    } else if (!docNro.serie) {
      faltan.push(`Se reconocio el numero <b>${docNro.numero}</b> pero no la <b>serie</b>.`);
    } else if (!docNro.numero) {
      faltan.push(`Se reconocio la serie <b>${docNro.serie}</b> pero no el <b>numero correlativo</b>.`);
    }

    if (!this.modelIni || !this.modelIni.year || !this.modelIni.month || !this.modelIni.day) {
      faltan.push('Falta la <b>fecha de emision</b>.');
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      faltan.push('El <b>importe total</b> esta en cero; SUNAT valida el comprobante contra su monto.');
    }

    return faltan;
  }

  /**
   * Cuantas lecturas alternativas se le consultan a SUNAT como maximo. Cada
   * una es una llamada con su token, asi que no conviene pasarse.
   */
  private readonly MAX_VARIANTES_SUNAT = 12;

  /**
   * SUNAT dijo que el comprobante NO EXISTE. Antes de darlo por perdido se
   * reconsultan las lecturas que el OCR pudo haber confundido (E por F, 1 por
   * 7, 0 por 8...), ordenadas por probabilidad.
   *
   * Si alguna existe, esa ES la correcta: SUNAT valida RUC + serie + numero +
   * fecha + monto a la vez, asi que un acierto con los otros cuatro campos
   * iguales no es casualidad. Por eso se aplica sola, sin preguntar.
   */
  private async reintentarConVariantes(docNro: NroComprobante):
      Promise<{ variante: VarianteComprobante; response: Response } | null> {

    const variantes = generarVariantesComprobante(
      docNro.serie, docNro.numero, this.MAX_VARIANTES_SUNAT);

    if (!variantes.length) { return null; }

    Swal.fire({
      title: 'Revisando la lectura del comprobante',
      html: `<div style="text-align:left; font-family: var(--app-font-family, Arial);">
               <p>SUNAT no encontro <b>${docNro.serie}-${docNro.numero}</b>.</p>
               <p id="varianteProgreso" style="font-size:0.9em; color:#555;">
                 Probando lecturas alternativas (1 de ${variantes.length})...</p>
             </div>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    for (let i = 0; i < variantes.length; i++) {
      const v = variantes[i];

      const progreso = document.getElementById('varianteProgreso');
      if (progreso) {
        progreso.textContent = `Probando ${v.serie}-${v.numero} (${i + 1} de ${variantes.length})...`;
      }

      const intento: WrapperComprobanteSunat = {
        ...this.wrapper,
        numeroSerie: v.serie,
        numero: v.numero,
      };

      try {
        const resp: any = await firstValueFrom(this.sunatService.validarComprobante(intento));
        const estado = String(resp?.resultado?.data?.estadoCp ?? '');

        // 1 = ACEPTADO, 3 = AUTORIZADO. Cualquier otro estado no confirma nada.
        if (estado === '1' || estado === '3') {
          Swal.close();
          console.info('[SUNAT] lectura corregida por reintento',
            { leido: `${docNro.serie}-${docNro.numero}`, correcto: `${v.serie}-${v.numero}`, motivo: v.motivo });
          return { variante: v, response: resp as Response };
        }
      } catch (e) {
        // Una variante que falla no aborta la busqueda: se sigue con la siguiente.
        console.warn('[SUNAT] fallo la consulta de una variante', v, e);
      }
    }

    Swal.close();
    return null;
  }

  /**
   * @param silencioso true cuando la dispara el escaneo y no el usuario: en
   *        ese caso el exito se informa con un toast en vez de un dialogo, y
   *        los datos incompletos no interrumpen. El rechazo de SUNAT si
   *        interrumpe siempre, porque exige una decision.
   */
  validarComprobante(silencioso: boolean = false, rechazoDiscreto: boolean = false) {
    // El parseo tolerante vive en comprobante-numero.util.ts y es el mismo
    // algoritmo que usa el OCR, asi que lo que lee el OCR y lo que valida el
    // frontend nunca discrepan.
    const docNro: NroComprobante = parseNroComprobante(
      this.dataImagen.documentNumber ?? '',
      this.devolverDocumento(this.codDocumentoGeneral),
    );

    // 🔒 GUARD: si falta cualquier dato que SUNAT exige, no se llama a la API.
    // El 422 de SUNAT le llega al usuario como un "No se pudo validar el
    // comprobante" que no explica nada.
    const faltantes = this.faltantesParaSunat(docNro);
    if (faltantes.length) {
      this.validaComprobante = false;

      if (silencioso) {
        console.info('[validarComprobante] datos incompletos, sin avisar', faltantes);
        return;
      }

      Swal.fire({
        title: faltantes.length === 1 ? 'Falta un dato para validar' : `Faltan ${faltantes.length} datos para validar`,
        html: `
          <div style="text-align:left; font-family: var(--app-font-family, Arial);">
            <ul style="margin:0 0 10px 0; padding-left:18px;">
              ${faltantes.map(f => `<li style="margin-bottom:6px;">${f}</li>`).join('')}
            </ul>
            <div style="border-top:1px solid #dee2e6; padding-top:8px; font-size:0.85em; color:#666;">
              Nro. Documento leido: <code>${this.dataImagen.documentNumber || '(vacio)'}</code>
            </div>
          </div>`,
        icon: 'warning',
        confirmButtonText: 'OK',
      }).then(() => {
        if (!docNro.ok) { document.getElementById('nrodoc')?.focus(); }
      });

      console.warn('[validarComprobante] datos incompletos para SUNAT', {
        faltantes,
        nroDocumento: this.dataImagen.documentNumber,
        advertencias: docNro.advertencias,
      });
      return;
    }

    // Deja el campo en el formato interno SERIE-000000000000001.
    this.dataImagen.documentNumber = docNro.formateado;

    this.wrapper.rucConsultante = sessionStorage.getItem("ruc") ?? '';
    this.wrapper.numRuc = this.ruc;
    this.wrapper.codComp = (this.getDocumentoSeleccionado()?.codSunat ?? '').trim();
    this.wrapper.numeroSerie = docNro.serie;
    // SUNAT espera el correlativo SIN ceros a la izquierda.
    this.wrapper.numero = docNro.numero;
    this.wrapper.fechaEmision = this.formatFecha(this.modelIni);
    this.wrapper.monto = String(this.total);

    if (docNro.reparado || docNro.advertencias.length) {
      console.info('[validarComprobante] numero interpretado', docNro);
    }
    console.log("Wrapper : ", this.wrapper);

    // Resetea el flag mientras se ejecuta la validación contra SUNAT.
    // El botón Guardar dependerá de que esto vuelva a true tras una respuesta exitosa.
    this.validaComprobante = false;

    this.sunatService.validarComprobante(this.wrapper).subscribe({
      next: async (respuestaOriginal: Response) => {
        let response = respuestaOriginal;
        let correccion: { antes: string; ahora: string; motivo: string } | null = null;

        // Si SUNAT dice que no existe, puede ser una mala lectura del OCR y no
        // un comprobante inexistente: se reconsultan las variantes plausibles.
        if (String((response?.resultado as any)?.data?.estadoCp ?? '') === '0') {
          const hallazgo = await this.reintentarConVariantes(docNro);

          if (hallazgo) {
            response = hallazgo.response;
            correccion = {
              antes: `${docNro.serie}-${docNro.numero}`,
              ahora: `${hallazgo.variante.serie}-${hallazgo.variante.numero}`,
              motivo: hallazgo.variante.motivo,
            };

            // Se completa el formulario con la lectura correcta.
            this.wrapper.numeroSerie = hallazgo.variante.serie;
            this.wrapper.numero = hallazgo.variante.numero;
            this.dataImagen.documentNumber =
              `${hallazgo.variante.serie}-${hallazgo.variante.numero.padStart(LARGO_PADDING, '0')}`;
          }
        }

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

        // Datos adicionales del RUC. Se muestran solo si vienen en la respuesta.
        //
        // OJO CON EL ESTADO DEL RUC. Antes esto era
        //     estadoRuc === '00' ? 'ACTIVO' : 'NO ACTIVO'
        // y el else hacia de catalogo: cualquier valor inesperado —un codigo
        // de un digito, un texto, un campo vacio— se mostraba en rojo como
        // "NO ACTIVO", que es un estado que SUNAT NO TIENE. Los suyos son
        // ACTIVO, SUSPENSION TEMPORAL, BAJA PROVISIONAL, BAJA DEFINITIVA y
        // las dos bajas de oficio. Le decia a la gente que un proveedor
        // estaba de baja cuando estaba perfecto.
        //
        // Ahora se reconoce lo que se puede sostener y se ADMITE cuando no se
        // reconoce, en gris, mostrando el valor crudo. Un dato que falta se
        // consulta; una afirmacion falsa se cree.
        const estadoRuc = this.leerEstadoRuc(data.estadoRuc);
        const estadoRucTxt = estadoRuc.texto;
        const condDomi = this.leerCondicionDomicilio(data.condDomiRuc);
        const condDomiTxt = condDomi.texto;

        // LO QUE SE MUESTRA es el estado EFECTIVO, no el crudo del
        // comprobante.
        //
        // Es la misma regla asimetrica que se aplica a padronRuc: si la ficha
        // de SUNAT dice ACTIVO, eso es lo que se muestra, aunque el servicio
        // de comprobantes devuelva un codigo de baja. Ese servicio no conoce
        // los RUC nuevos —al 20612227242, inscrito el 31/07/2026, le devolvia
        // codigo 11 (BAJA DE OFICIO) mientras la ficha decia ACTIVO— y aca
        // se estaba imprimiendo tal cual, en rojo, sobre un proveedor sano.
        const efectivo = this.estadoEfectivo(estadoRuc);
        const condEfectiva = this.condicionEfectiva(condDomi);

        const detalles: string[] = [];
        if (efectivo.texto) {
          detalles.push(
            `<b>Estado del RUC:</b> <span style="color:${efectivo.color}; font-weight:bold;">${efectivo.texto}</span>`
          );
        }
        if (condEfectiva.texto) {
          detalles.push(
            `<b>Condición de domicilio:</b> <span style="color:${condEfectiva.color}; font-weight:bold;">${condEfectiva.texto}</span>`
          );
        }
        if (data.observaciones)   detalles.push(`<b>Observaciones:</b> ${data.observaciones}`);

        const avisoCorreccion = correccion
          ? `<div style="background:#fff3cd; border:1px solid #ffe69c; border-radius:4px;
                        padding:8px; margin-bottom:10px; font-size:0.9em;">
               El OCR habia leido <b>${correccion.antes}</b>. SUNAT no lo encontro y si encontro
               <b>${correccion.ahora}</b> con el mismo RUC, fecha e importe (${correccion.motivo}),
               asi que se corrigio el Nro. Documento.
             </div>`
          : '';

        const html = `
          <div style="text-align:left; font-family: var(--app-font-family, Arial);">
            ${avisoCorreccion}
            <p style="margin-bottom:${detalles.length ? '10px' : '0'};">${info.mensaje}</p>
            ${detalles.length ? `<div style="border-top:1px solid #dee2e6; padding-top:8px; font-size:0.9em; color:#555;">
              ${detalles.join('<br>')}
            </div>` : ''}
          </div>
        `;

        // Estado y condicion del RUC salen de la validacion del comprobante,
        // que es SUNAT en vivo, y pisan al padron.
        //
        // Se aplican pase lo que pase con el comprobante: estadoRuc y
        // condDomiRuc describen al EMISOR, no al documento, y SUNAT los
        // devuelve igual cuando el comprobante no existe. Antes solo se
        // tomaban si el comprobante era valido, asi que un proveedor activo
        // seguia figurando "no activo" con el dato del padron —que es una
        // foto y envejece— pese a que SUNAT acababa de decir lo contrario.
        if (this.padronRuc) {
          // Se recuerda lo que dijo el comprobante, pero solo se aplica si
          // MEJORA lo que ya se sabe. Ver la nota en handleRucResponse.
          if (estadoRucTxt) {
            this.estadoRucDeSunat = estadoRucTxt;
            if (this.esActivo(estadoRucTxt) && !this.esActivo(this.padronRuc.estado)) {
              this.padronRuc.estado = estadoRucTxt;
            }
          }
          if (condDomiTxt) {
            this.condicionRucDeSunat = condDomiTxt;
            if (this.esHabido(condDomiTxt) && !this.esHabido(this.padronRuc.condicion)) {
              this.padronRuc.condicion = condDomiTxt;
            }
          }
          // Las reglas de RUC activo y domicilio habido se evaluan de nuevo
          // con el dato recien traido: si no, el mensaje del padron queda en
          // pantalla contradiciendo lo que la misma consulta acaba de decir.
          if (estadoRucTxt || condDomiTxt) {
            this.validateRules();
          }
        }

        this.validaComprobante = info.valido;
        this.estadoSunat = estadoCp;

        // En automatico, un comprobante correcto no merece un dialogo que
        // haya que cerrar; uno rechazado si, porque el usuario debe decidir.
        if (silencioso && info.valido) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: correccion ? 'Validado (se corrigio la lectura)' : 'Comprobante validado por SUNAT',
            text: correccion ? `${correccion.antes} -> ${correccion.ahora}` : info.titulo,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
          });
          return;
        }

        // El rechazo llega como toast cuando la consulta la disparo el usuario
        // escribiendo. Interrumpirlo con un modal que no pidio, mientras
        // todavia esta llenando el formulario, lo unico que logra es que lo
        // cierre sin leerlo.
        if (rechazoDiscreto) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: info.tipo === 'success' ? 'success' : 'warning',
            title: info.titulo,
            text: info.mensaje,
            showConfirmButton: false,
            timer: 6000,
            timerProgressBar: true,
          });
          return;
        }

        Swal.fire({
          title: info.titulo,
          html,
          icon: info.tipo,
          confirmButtonText: 'OK',
        });
      },
      error: (err) => {
        this.validaComprobante = false;     // Error de red → tampoco habilita

        if (silencioso) {
          // La validacion automatica no interrumpe por un problema de red:
          // el usuario puede reintentar con el boton cuando quiera.
          console.warn('[validacion automatica] fallo la consulta a SUNAT', err);
          Swal.fire({
            toast: true, position: 'top-end', icon: 'warning',
            title: 'No se pudo validar automaticamente',
            text: 'Use el boton Validar cuando quiera reintentar.',
            showConfirmButton: false, timer: 4000, timerProgressBar: true,
          });
          return;
        }

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

  /**
   * Separa serie y numero de lo que haya en el campo "Nro. Documento".
   *
   * Delega en `parseNroComprobante` (comprobante-numero.util.ts), que tolera
   * guiones largos, etiquetas N°/Nro, serie pegada al numero, saltos de linea,
   * ceros a la izquierda y las confusiones tipicas del OCR (O/0, I/1, S/5).
   * Se mantiene la firma anterior para no romper a los llamadores.
   */
  parseNroDocumento(nroDocumento: string): { numeroSerie: string; numero: string } {
    const r = parseNroComprobante(nroDocumento);
    return { numeroSerie: r.serie, numero: r.numero };
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

