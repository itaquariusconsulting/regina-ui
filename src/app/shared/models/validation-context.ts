import { DatosImagen } from '../../views/orden-pago/edit-rendir-cuenta/edit-rendir-cuenta.component';
import { PadronRuc } from '../../models/padron-ruc';
import { RegRenValidate } from '../../models/reg-ren-validate';

export interface ValidationContext {
  reglas: RegRenValidate[];
  dataImagen: DatosImagen;
  padronRuc: PadronRuc;
}