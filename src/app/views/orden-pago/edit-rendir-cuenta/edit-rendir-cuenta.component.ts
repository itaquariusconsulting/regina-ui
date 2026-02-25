import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import Tesseract from 'tesseract.js';
import { OrdenPago } from '../../../models/orden-pago';
import { OcrService } from '../../../services/ocr.service';
import { NgxCurrencyDirective } from 'ngx-currency';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { Observable } from 'rxjs';
import { SunatService } from '../../../services/sunat-service';
import { Response } from '../../../models/response';
import { Router } from '@angular/router';
import { PadronRuc } from '../../../models/padron-ruc';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { RegRenValidate } from '../../../models/reg-ren-validate';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog-component';
import { MatDialog } from '@angular/material/dialog';
import {
  DocumentType,
  DocumentSection,
  FieldCode,
  DependsOnValue,
  RucStatus,
  RucCondition
} from '../../../shared/constants/validation-constants';

export class ItemDetalle {
  descripcion?: string;
  // agrega aquí otras propiedades si las tienes
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
    private regRenValidateService: RegRenValidateService,
    private dialog: MatDialog
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

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
  typeMovements: TypeMovement[] = [{ idMovement: 1, detMovement: "Alimentación" }, { idMovement: 2, detMovement: "Transpporte" }]
  TypeMovement: TypeMovement = new TypeMovement();

  ngOnInit(): void {
    this.TypeMovement = this.typeMovements[0];
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data;
    }
    this.loadValidationRules();
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

  validateRules(): boolean {
    this.mensaje = '';
    this.validate = true;

    this.reglas.forEach(rule => {
      if (!rule.fieldCode || !rule.errorMessage || !rule.dependsOnField || !rule.dependsOnValue) {
        console.warn('Regla inválida, falta fieldCode o errorMessage:', rule);
        return;
      }

      const fieldValue = this.getFieldValue(rule.fieldCode);
      const dependsValue = this.getDependsValue(
        rule.dependsOnField,
        rule.dependsOnValue
      );

      if (rule.isRequired && (!fieldValue || !dependsValue)) {
        this.addError(rule.errorMessage);
        return;
      }

      if (rule.fieldCode === FieldCode.LOGO_TEXT && dependsValue) {
        if (!fieldValue?.includes(dependsValue)) {
          this.addError(
            `${rule.errorMessage} - Razón Social obtenida ${dependsValue}`
          );
        }
      }
    });

    return this.validate;
  }

  private getFieldValue(fieldCode: string): string | undefined {
    const fieldMap: Record<string, () => string | undefined> = {
      LOGO_TEXT: () =>
        this.dataImagen.issuerName?.trim().toLowerCase()
    };

    return fieldMap[fieldCode]?.();
  }

  private getDependsValue(
    dependsOnField: string,
    dependsOnValue: string
  ): string | undefined {
    const dependsMap: Record<string, () => string | undefined> = {
      RUC: () => {
        if (dependsOnValue === DependsOnValue.RAZON_SOCIAL_BY_RUC) {
          return this.padronRuc?.razonSocial?.trim().toLowerCase();
        }
        return undefined;
      }
    };

    return dependsMap[dependsOnField]?.();
  }

  private addError(message: string): void {
    this.mensaje += message + '\n';
    this.validate = false;
  }

  onGetDatosRuc(): void {
    this.sunatService.getDataRUC(this.ruc).subscribe({
      next: (response: Response) => this.handleRucResponse(response),
      error: () => this.handleRucError()
    });
  }

  private handleRucResponse(response: Response): void {
    if (!response || response.error !== 0) {
      this.validate = false;
      return;
    }

    this.padronRuc = response.resultado;
    this.mensaje = '';
    this.validate = true;

    if (this.padronRuc.estado !== RucStatus.ACTIVO) {
      this.setValidationError('EL CONTRIBUYENTE NO SE ENCUENTRA ACTIVO');
      return;
    }

    if (this.padronRuc.condicion !== RucCondition.HABIDO) {
      this.setValidationError('EL CONTRIBUYENTE TIENE CONDICIÓN NO HABIDO');
      return;
    }

    this.dataImagen.issuerAddress = this.buildDireccion(this.padronRuc);

    this.validateRules();
  }

  private buildDireccion(data: any): string {
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

  private setValidationError(message: string): void {
    this.mensaje = message;
    this.validate = false;
  }

  private handleRucError(): void {
    this.validate = false;

    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Error',
        message: 'El RUC no existe'
      }
    });
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
        this.buildDetalle();
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

    const issuerRuc = detected.issuerRuc;
    this.dataImagen.issuerRuc = issuerRuc;

    this.ruc = Array.isArray(issuerRuc) ? issuerRuc[0] : issuerRuc;
    console.log('RUC detectado:', this.ruc);
  }

  private buildDetalle(): void {
    this.detalle = this.dataImagen.items
      ?.map(item => item.descripcion)
      .join(' ') || '';
  }

  // ===============================
  // Recorte
  // ===============================
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

  // ===============================
  // OCR sobre el recorte
  // ===============================
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

  ruccompleto() {
    if (this.ruc.length == 11) {
      this.onGetDatosRuc();
    } else {
      this.mensaje = "";
      this.validate = false;
    }
  }

  onSave(): void {
    console.log("aqui estoy");
    if (!this.validateRules()) {
      console.log("Errores");
      return; // detiene el guardado si falla alguna regla
    }
  }
}

