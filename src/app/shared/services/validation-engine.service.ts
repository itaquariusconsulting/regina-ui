import { Injectable } from '@angular/core';
import { ValidationContext } from '../models/validation-context';
import { FieldCode, DependsOnValue } from '../constants/validation-constants';

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
      if (!rule.fieldCode || !rule.errorMessage || !rule.dependsOnField || !rule.dependsOnValue) {
        return;
      }

      const fieldValue = this.getFieldValue(rule.fieldCode, context);
      const dependsValue = this.getDependsValue(rule.dependsOnField, rule.dependsOnValue, context);

      if (rule.isRequired && (!fieldValue || !dependsValue)) {
        errors.push(rule.errorMessage);
        return;
      }

      if (rule.fieldCode === FieldCode.LOGO_TEXT && dependsValue) {
        if (!fieldValue?.includes(dependsValue)) {
          errors.push(`${rule.errorMessage} - Razón Social obtenida ${dependsValue}`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private getFieldValue(fieldCode: string, context: ValidationContext): string | undefined {

    const fieldMap: Record<string, () => string | undefined> = {
      LOGO_TEXT: () =>
        context.dataImagen.issuerName?.trim().toLowerCase()
    };

    return fieldMap[fieldCode]?.();
  }

  private getDependsValue(
    dependsOnField: string,
    dependsOnValue: string,
    context: ValidationContext
  ): string | undefined {

    const dependsMap: Record<string, () => string | undefined> = {
      RUC: () => {
        if (dependsOnValue === DependsOnValue.RAZON_SOCIAL_BY_RUC) {
          return context.padronRuc?.razonSocial?.trim().toLowerCase();
        }
        return undefined;
      }
    };

    return dependsMap[dependsOnField]?.();
  }
}