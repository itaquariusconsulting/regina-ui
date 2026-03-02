import { Injectable } from '@angular/core';
import { ValidationContext } from '../models/validation-context';
import {
  FieldCode,
  RucStatus,
  RucCondition,
  DocumentType
} from '../constants/validation-constants';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ValidationEngineService {

  public validateRule(rule: any, context: ValidationContext): string | null {
    if (!rule.fieldCode || !rule.errorMessage) {
      return null;
    }

    const validator = this.validators[rule.fieldCode as FieldCode];

    return validator ? validator(rule, context) : null;
  }

  public validate(context: ValidationContext): ValidationResult {
    if (!context.reglas?.length) {
      return { isValid: true, errors: [] };
    }

    const errors = context.reglas
      .map(rule => this.validateRule(rule, context))
      .filter((error): error is string => !!error);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  //--VALIDATION STRATEGY MAP--
  private validators: Record<
    FieldCode,
    (rule: any, context: ValidationContext) => string | null
  > = {
      [FieldCode.LOGO_TEXT]: (r, c) => this.validateLogoText(r, c),
      [FieldCode.RUC_INPUT]: (r, c) => this.validateRucInput(r, c),
      [FieldCode.RUC_STATUS]: (r, c) => this.validateRucState(r, c),
      [FieldCode.RUC_CONDITION]: (r, c) => this.validateRucCondition(r, c),
      [FieldCode.DOCUMENT_TYPE]: (r, c) => this.validateDocumentType(r, c),
      [FieldCode.DOCUMENT_ITEMS]: (r, c) => this.validateDocumentItems(r, c)
    };

  //--VALIDATION METHODS--
  private validateLogoText(rule: any, context: ValidationContext): string | null {
    const logoText = context.dataImagen?.issuerName?.trim().toLowerCase();
    const razonSocial = context.padronRuc?.razonSocial?.trim().toLowerCase();

    if (!logoText || !razonSocial) {
      return rule.errorMessage;
    }

    return logoText.includes(razonSocial)
      ? null
      : `${rule.errorMessage} - Razón Social obtenida ${razonSocial}`;
  }

  private validateRucInput(rule: any, context: ValidationContext): string | null {
    const ruc = context.padronRuc?.ruc;

    if (!ruc) {
      return rule.errorMessage;
    }

    const validLength = /^\d{11}$/.test(ruc);
    const validPrefix = /^(10|15|17|20)/.test(ruc);

    return validLength && validPrefix
      ? null
      : rule.errorMessage;
  }

  private validateRucState(rule: any, context: ValidationContext): string | null {
    return context.padronRuc?.estado === RucStatus.ACTIVO
      ? null
      : rule.errorMessage;
  }

  private validateRucCondition(rule: any, context: ValidationContext): string | null {
    return context.padronRuc?.condicion === RucCondition.HABIDO
      ? null
      : rule.errorMessage;
  }

  private validateDocumentType(rule: any, context: ValidationContext): string | null {
    const docType = context.dataImagen?.documentType?.trim().toUpperCase();
    const allowedTypes = Object.values(DocumentType);

    return docType && allowedTypes.includes(docType as DocumentType)
      ? null
      : rule.errorMessage;
  }

  private validateDocumentItems(rule: any, context: ValidationContext): string | null {
    //function logic goes here.
    const items = context.dataImagen?.items || [];

    return null;
  }
}