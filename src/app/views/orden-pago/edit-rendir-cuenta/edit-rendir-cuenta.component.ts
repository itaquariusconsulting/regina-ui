import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
import { MatDialog } from '@angular/material/dialog';
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
  styleUrl: './edit-rendir-cuenta.component.scss'
})

export class EditRendirCuentaComponent implements OnInit {

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
  padronRuc: PadronRuc = new PadronRuc();
  reglas: RegRenValidate[] = [];
  keywords: RegRenKeywordDTO[] = [];
  typeMovements: TypeMovement[] = [{ idMovement: 1, detMovement: "Alimentación" }, { idMovement: 2, detMovement: "Transpporte" }]
  TypeMovement: TypeMovement = new TypeMovement();
  rubros: MaeRubro[] = [];
  tiposGasto: MaeTipoGasto[] = [];
  ordenPagoDet: OrdenPagoDet = new OrdenPagoDet();
  ngOnInit(): void {
    this.TypeMovement = this.typeMovements[0];
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data;
    }

    const user = sessionStorage.getItem('user')
      ? JSON.parse(sessionStorage.getItem('user')!)
      : null;
    this.codEmpresa = user?.codEmpresa || '';
    this.getRubros();
    this.loadValidationRules();
    this.loadValidationKeywords();
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
      },
      (error) => {
        console.error('Error al cargar tipos de gasto', error);
      }
    );
  }

  changeRubro(): void {
    if (this.ordenPagoDet.codRubro) {
      this.getTiposGasto(this.ordenPagoDet.codRubro);
    }
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
    this.dataImagen.documentNumber = detected.documentNumber;
    this.dataImagen.issuerName = detected.issuerName;
    this.dataImagen.issuerAddress = detected.issuerAddress;
    this.dataImagen.documentDate = detected.documentDate;
    this.dataImagen.amount = detected.amount;
    this.dataImagen.documentCurrency = detected.documentCurrency;
    this.dataImagen.items = detected.items;
    this.dataImagen.rawText = detected.rawText;

    const issuerRuc = detected.issuerRuc;
    this.dataImagen.issuerRuc = issuerRuc;
    this.ruc = Array.isArray(issuerRuc) ? issuerRuc[0] : issuerRuc;
  }

  onDetalleChange(value: string): void {
    const rule = this.reglas.find(r => r.fieldCode === FieldCode.DOCUMENT_ITEMS);
    if (!rule || !value || value.trim().length === 0) {
      this.mensaje = '';
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
    this.mensaje = error || '';
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

  onSave(): void {
    console.log("aqui estoy");
    if (!this.validateRules()) {
      console.log("Errores");
      return;
    }
  }
}

