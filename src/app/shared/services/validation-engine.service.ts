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

  validate(context: ValidationContext): ValidationResult {
    const errors: string[] = [];

    context.reglas.forEach(rule => {
      if (!rule.fieldCode || !rule.errorMessage) {
        return;
      }

      const validator = this.validators[rule.fieldCode as FieldCode];
      if (!validator) {
        return;
      }

      const error = validator.call(this, rule, context);
      if (error) {
        errors.push(error);
      }
    });

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
      [FieldCode.LOGO_TEXT]: this.validateLogoText,
      [FieldCode.RUC_INPUT]: this.validateRucInput,
      [FieldCode.RUC_STATUS]: this.validateRucState,
      [FieldCode.RUC_CONDITION]: this.validateRucCondition,
      [FieldCode.DOCUMENT_TYPE]: this.validateDocumentType,
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
    const type = context.dataImagen?.documentType?.trim().toUpperCase();

    if (!type) {
      return rule.errorMessage;
    }

    const allowedTypes = Object.values(DocumentType);

    return allowedTypes.includes(type as DocumentType)
      ? null
      : rule.errorMessage;
  }
}