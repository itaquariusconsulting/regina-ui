import { CommonModule, Location } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import Tesseract from 'tesseract.js';
import { OrdenPago } from '../../../models/orden-pago';
import { OcrService } from '../../../services/ocr.service';
import { NgxCurrencyDirective } from 'ngx-currency';
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
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog-component';
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
import { OrdenPagoDet } from '../../../models/orden-pago-det';
import { MaeTipoGasto } from '../../../models/mae-tipo-gasto';
import { MaeDocumento } from '../../../models/mae-documento';
import { MaeMoneda } from '../../../models/mae-moneda';
import { MaeImpuesto } from '../../../models/mae-impuesto';
import { OrdenPagoDetProv } from '../../../models/orden-pago-det-prov';
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
  amount?: string;
  items: ItemDetalle[] = [];
  currency?: string;
  rawText?: string;
}

export class TypeMovement {
  idMovement?: number;
  detMovement?: string;
}

@Component({
  selector: 'app-edit-rendir-cuenta',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImageCropperComponent,
    LoadingDancingSquaresComponent,
    NgxCurrencyDirective
  ],
  templateUrl: './edit-rendir-cuenta.component.html',
  styleUrl: './edit-rendir-cuenta.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
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
    private maestrosService: MaestrosService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }
  codEmpresa: string = sessionStorage.getItem('codempresa') || '';
  codAuxiliar: string = '';
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
  mensaje: string = "";
  mensajeDetalle: string = "";
  padronRuc: PadronRuc = new PadronRuc();
  reglas: RegRenValidate[] = [];
  keywords: RegRenKeywordDTO[] = [];
  typeMovements: TypeMovement[] = [{ idMovement: 1, detMovement: "Alimentación" }, { idMovement: 2, detMovement: "Transpporte" }]
  TypeMovement: TypeMovement = new TypeMovement();
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
  ordenPagoDet: OrdenPagoDet = new OrdenPagoDet();
  ordenPagoDetProvs: OrdenPagoDetProv[] = [];
  saldoSoles: number = 0;
  saldoDolares: number = 0;

  ngOnInit(): void {
    this.TypeMovement = this.typeMovements[0];
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data;
      this.saldoSoles = (this.orden.impSoles ?? 0) - (this.orden.impRendidoSoles ?? 0);
      this.saldoDolares = (this.orden.impDolares ?? 0) - (this.orden.impRendidoDolares ?? 0);
    }

    const user = sessionStorage.getItem('user')
      ? JSON.parse(sessionStorage.getItem('user')!)
      : null;
    this.codEmpresa = user?.codEmpresa || '';
    this.codAuxiliar = user?.codAuxiliar || '';
    this.ordenPagoDetProvs = [];
    this.loadValidationRules();
    this.loadValidationKeywords();
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
        this.reglas = (response?.resultado ?? []).filter(
          ({ documentType, documentSection }: RegRenValidate) =>
            documentType === DocumentType.FACTURA ||
            documentSection === DocumentSection.ENCABEZADO
        );
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

  validateRules(): boolean {
    const result = this.validationEngine.validate({
      reglas: this.reglas,
      dataImagen: this.dataImagen,
      padronRuc: this.padronRuc
    });

    this.mensaje = result.errors.join('\n');
    this.validate = result.isValid;

    return result.isValid;
  }

  onGetDatosRuc(): void {
    this.sunatService.getDataRUC(this.ruc).subscribe({
      next: (response: Response) => this.handleRucResponse(response),
      error: (err) => this.handleRucError(err)
    });
  }

  getRubros(): void {
    this.maestrosService.getRubros(this.codEmpresa).subscribe(
      (response: Response) => {
        this.rubros = response.resultado || [];
        this.ordenPagoDet.codRubro = this.rubros.length > 0 ? this.rubros[0].codRubro : '';
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
        this.ordenPagoDet.codTipoGasto = this.tiposGasto.length > 0 ? this.tiposGasto[0].codTipoGasto : '';
        this.getMonedas();

      },
      (error) => {
        console.error('Error al cargar tipos de gasto', error);
      }
    );
  }

  getTiposDocumento() {
    this.maestrosService.getTiposDocumento(this.codEmpresa).subscribe(
      (response: Response) => {
        this.documentos = response.resultado || [];
        this.documentosGeneral = this.documentos;
        this.ordenPagoDet.codDocumento = this.documentos[0].desCorta ?? 'NN';
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
    this.maestrosService.getImpuestos(this.codEmpresa, this.ordenPagoDet.codDocumento ?? '').subscribe(
      (response: Response) => {
        this.impuestos = response.resultado || [];
      },
      (error) => {
        console.error('Error al cargar impuestos', error);
      }
    );
  }

  calcularImpuestos() {
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
  }

  changeRubro(): void {
    if (this.ordenPagoDet.codRubro) {
      this.getTiposGasto(this.ordenPagoDet.codRubro);
    }
  }

  changeDocumento() {
    this.getImpuestos();
  }

  onMonedaChange() {
  }

  private handleRucResponse(response: Response): void {
    if (!response || response.error !== 0) {
      this.validate = false;
      return;
    }

    this.padronRuc = response.resultado;
    this.mensaje = '';
    this.validate = true;

    this.dataImagen.issuerAddress = this.buildDireccion(this.padronRuc);

    this.validateRules();
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
    let message = error?.error.mensaje
      || 'No se pudo consultar SUNAT. Intente nuevamente.';

    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Error',
        message,
        type: 'alert'
      }
    });

    this.validate = false;
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

        this.mapDetectedData(detected);
        this.onGetDatosRuc();
      },
      error: (err) => {
        console.error(err);
      },
      complete: () => {
        this.loadingService.hide();
      }
    });
  }

  private mapDetectedData(detected: any): void {
    this.dataImagen.documentType = detected.documentType;
    if (detected.documentType) {
      this.documentos = this.documentosGeneral.filter(doc => doc.desDocumento?.includes(detected.documentType));
      this.ordenPagoDet.codDocumento = this.documentos[0].desCorta ?? 'FV';
    }

    this.dataImagen.documentNumber = detected.documentNumber;
    this.dataImagen.issuerName = detected.issuerName;
    this.dataImagen.issuerAddress = detected.issuerAddress;
    this.dataImagen.documentDate = detected.documentDate;
    this.dataImagen.amount = detected.amount;

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
  }

  onDetalleChange(value: string): void {
    const rule = this.reglas.find(r => r.fieldCode === FieldCode.DOCUMENT_ITEMS);
    if (!rule || !value || value.trim().length === 0) {
      this.mensajeDetalle = '';
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
  }

  ruccompleto(): void {
    if (this.ruc.length !== RucInput.LENGTH) {
      this.mensaje = 'El RUC debe contener 11 dígitos.';
      this.validate = false;
      return;
    }

    this.onGetDatosRuc();
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

  onPrepareSave(): void {
    const numserie = this.dataImagen.documentNumber?.split('-')[0] ?? '';
    const numdoc = this.dataImagen.documentNumber?.split('-')[1] ?? '';

    this.rubroSeleccionado = this.rubros.find(r => r.codRubro === this.ordenPagoDet.codRubro) ?? new MaeRubro();
    this.tipoGastoSeleccionado = this.tiposGasto.find(t => t.codTipoGasto === this.ordenPagoDet.codTipoGasto) ?? new MaeTipoGasto();
    this.documentoSeleccionado = this.documentos.find(d => d.desCorta === this.ordenPagoDet.codDocumento) ?? new MaeDocumento();

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

    this.ordenPagoDet.codEmpresa = this.codEmpresa;
    this.ordenPagoDet.numOrden = this.orden.numOrden;
    this.ordenPagoDet.codCuentaConcepto = this.tipoGastoSeleccionado.codCuentaSoles;

    this.calcularImpuestos();

  }

  onSave(): void {
    this.onPrepareSave();
    if (!this.validateRules()) {
      return;
    }
  }
}

