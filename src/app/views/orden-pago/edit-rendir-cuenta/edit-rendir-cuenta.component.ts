import { CommonModule, Location } from '@angular/common';
import { Component, NO_ERRORS_SCHEMA, OnInit, TemplateRef, ViewChild } from '@angular/core';
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
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ValidationEngineService } from '../../../shared/services/validation-engine.service';
import { ValidationContext } from '../../../shared/models/validation-context';
import {
  RucInput,
  DocumentType,
  DocumentSection,
  FieldCode,
} from '../../../shared/constants/validation-constants';
import { MaestrosService } from '../../../services/maestros.service';
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
import { OrdenPagoPlanillaMovilidadDet } from '../../../models/orden-pago-planilla-movilidad-det';
import { MOCK_PLANILLA_MOVILIDAD } from './planilla-movilidad-mock';
import { OrdenPagoDetProvService } from '../../../services/orden-pago-det-prov.service';
import { WrapperRequestDocumebtoExistente } from '../../../models/wrappers/wrapper-request-documento-existente';
import { NgxCurrencyDirective } from 'ngx-currency';
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
    private config: NgbDatepickerConfig
  ) {
    this.isLoading$ = this.loadingService.loading$;
    this.config.navigation = 'select';
  }

  codEmpresa: string = sessionStorage.getItem('codempresa') || '';
  codAuxiliar: string = '';
  auxiliarProveedor: MaeAuxiliarDTO = new MaeAuxiliarDTO();
  listaAuxiliares: MaeAuxiliarDTO[] = [];
  orden: OrdenPago = new OrdenPago();
  dataImagen: DatosImagen = new DatosImagen();
  imageChangedEvent: Event | null = null;
  previewImage: string | null = null;
  croppedImage: string | null = null;
  showImageCropper = true;
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
  isDesktop: boolean = false;
  items: any[] = [];
  itemsText: string = '';
  nroItemOp: string = "";
  subTotal: number = 0;
  impuesto: number = 0;
  total: number = 0;
  selectedFile?: File;

  codRubroDefault?: string = "";
  codTipoGastoDefault?: string = "";

  codRubroMovilidad?: string = "";
  codTipoGastoMovilidad?: string = "";
  codDocumentoGeneral: string = "";

  indMovilidad?: string = "N";
  listaMovilidad: OrdenPagoPlanillaMovilidadDet[] = MOCK_PLANILLA_MOVILIDAD;
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
      if (this.indMovilidad == 'S') {
        this.codRubroMovilidad = this.configService.get('COD_RUBRO_MOVILIDAD');
        this.codTipoGastoMovilidad = this.configService.get('COD_TIPO_GASTO_MOVILIDAD');
      } else {
        this.codRubroDefault = this.configService.get('COD_RUBRO_GENERAL');
        this.codTipoGastoDefault = this.configService.get('COD_TIPO_GASTO_GENERAL');
      }
      this.saldoSoles = (this.orden.impSoles ?? 0) - (this.orden.impRendidoSoles ?? 0);
      this.saldoDolares = (this.orden.impDolares ?? 0) - (this.orden.impRendidoDolares ?? 0);
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
    this.saldoSoles = (this.orden.impSoles ?? 0) - (this.orden.impRendidoSoles ?? 0);
    this.saldoDolares = (this.orden.impDolares ?? 0) - (this.orden.impRendidoDolares ?? 0);

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
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: 'Error',
                message: 'El documento ya existe',
                type: 'alert'
              }
            });
            resolve(0);
          } else if (response.error == 2) {
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: 'Error',
                message: 'Error al Ingresar Documento',
                type: 'alert'
              }
            });
            resolve(0);
          } else {
            resolve(1);
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
          resolve(0);
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
        this.tiposGasto = response.resultado || [];
        if (this.indMovilidad !== 'S') {
          if (this.codTipoGastoDefault?.length == 0) {
            this.ordenPagoDet.codTipoGasto = this.tiposGasto.length > 0 ? this.tiposGasto[0].codTipoGasto : '';
          } else {
            this.ordenPagoDet.codTipoGasto = this.codTipoGastoDefault;
          }
        } else {
          this.ordenPagoDet.codTipoGasto = this.codTipoGastoMovilidad;
        }
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
        this.documentos = response.resultado;
        this.documentosGeneral = this.documentos;
        this.documentoSeleccionado = this.documentos[0];
        this.ordenPagoDet.codDocumento = this.documentoSeleccionado.codDocumento;
        this.codDocumentoGeneral = this.documentoSeleccionado.codDocumento!;
        this.ordenPagoDet.codCuentaDocumento = this.orden.codMoneda == '01' ? this.documentoSeleccionado.codCuentaSoles : this.documentoSeleccionado.codCuentaDolares;
        this.getImpuestos();
      },
      (error) => {
        console.error('Error al cargar tipos de documento', error);
      }
    );
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
    this.mensaje = '';
    this.hasValidRules = true;
    this.hasValidState();
    this.dataImagen.issuerAddress = this.buildDireccion(this.padronRuc);
    this.validateRules({ skipRule });
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

  onSelectImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    this.loadingService.show();
    const file = input.files[0];
    this.imageChangedEvent = event;
    this.selectedFile = file;
    this.loadPreview(file);
    this.processImage(file);
  }

  private loadPreview(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.previewImage = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  private processImage(file: File): void {
    this.ocrService.uploadImage(file).subscribe({
      next: (response: any) => {
        const detected = response?.detectedData;
        if (!detected) {
          return;
        }
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

  private mapDetectedData(detected: any): boolean {
    this.dataImagen.documentType = detected.documentType;
    if (this.dataImagen.documentType?.startsWith('F')) {
      this.dataImagen.documentType = 'F';
    }
    if (this.dataImagen.documentType?.startsWith('B')) {
      this.dataImagen.documentType = 'B';
    }
    if (this.dataImagen.documentType?.startsWith('R')) {
      this.dataImagen.documentType = 'R';
    }
    if (this.dataImagen.documentType) {
      this.documentos = this.documentosGeneral.filter(doc => doc.codDocumento?.substring(0, 1) == (this.dataImagen.documentType!));
      this.ordenPagoDet.codDocumento = this.documentos[0].codDocumento;
      this.ordenPagoDet.codCuentaDocumento =
        this.ordenPagoDet.codMoneda == '01' ? this.documentos[0].codCuentaSoles : this.documentos[0].codCuentaDolares;
      this.codDocumentoGeneral = this.ordenPagoDet.codDocumento!;
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

    if (!this.changeDate()) {
      return false;
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

    this.cargarItems(this.dataImagen.items);
    return true;
  }

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

  changeDate(): boolean {
    if (!this.isFechaValida(this.modelIni)) {
      this.inicializa();
      this.dialog.open(ConfirmDialogComponent, {
        width: '280px',
        data: {
          title: 'Alerta',
          message: "La fecha no puede ser menor que la fecha de generación de la Orden de Pago.",
          type: 'alert'
        }
      });
      return false;
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
      .uploadImage(wrapper)
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
      this.ordenPagoDet.anoProcesoDeclara = this.dataImagen.documentDate ? String(new Date(this.dataImagen.documentDate).getFullYear()) : undefined;
      this.ordenPagoDet.codAuxiliar = this.codAuxiliar;
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

      const totalPorcentaje = 1 + ((this.impuestos.reduce((total, impuesto) => total + (impuesto.numPorcentaje || 0), 0)) / 100);
      this.ordenPagoDet.impImponSoles = this.ordenPagoDet.impSoles - (this.ordenPagoDet.impSoles / totalPorcentaje);
      this.ordenPagoDet.impImponDolares = this.ordenPagoDet.impDolares - (this.ordenPagoDet.impDolares / totalPorcentaje);

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
            wrapper.extension = "PNG";
            wrapper.numOrden = this.orden.numOrden;
            wrapper.numItem = this.nroItemOp;
            wrapper.tipoDocumento = this.ordenPagoDet.codDocumento;

            if (!this.selectedFile) {
              this.onSaveImpuestos();
              return;
            }

            this.documentoService.uploadImage(wrapper).subscribe(
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
    const igv = Number(this.dataImagen.igv);
    const amount = Number(this.dataImagen.amount);
    const isDocNumValid = this.isDocumentNumberValid(docNum);

    return !this.validate || !docNum || !isDocNumValid || subTotal === 0 || igv === 0 || amount === 0;
  }

  changeImporte(importe: Event) {
    this.total = Number(importe);
    console.log(this.total);
    const totalPorcentaje = 1 + ((this.impuestos.reduce((total, impuesto) => total + (impuesto.numPorcentaje || 0), 0)) / 100);
    this.subTotal = this.total / totalPorcentaje;
    this.impuesto = this.total - this.subTotal;
  }

  private isDocumentNumberValid(value: string): boolean {
    if (!value) return false;

    const pattern = /^[A-Za-z0-9]{1,4}-\d{15}$/;
    return pattern.test(value.trim());
  }


}

