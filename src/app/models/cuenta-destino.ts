/**
 * Una cuenta bancaria a la que el trabajador puede devolver su saldo.
 *
 * Hoy hay una sola —la corriente en soles del BCP— y sale de config.ini,
 * no del ERP: son datos que cambian una vez cada varios anios, y leerlos de
 * un archivo evita un endpoint nuevo contra CONTABILIDAD para devolver
 * siempre la misma fila.
 *
 * Aun asi la pantalla trabaja con una LISTA y un combo, no con una cuenta
 * suelta: el dia que agreguen la cuenta en dolares o la de otro banco, es
 * agregar claves al archivo y no rehacer el formulario.
 */
export interface CuentaDestino {

  /** El auxiliar del banco en el ERP (MAE_AUXILIAR). */
  codAuxiliarBco: string;

  desBanco: string;
  numCuenta: string;

  /** '01' soles, '02' dolares. Tiene que coincidir con la de la orden. */
  codMoneda: string;

  /** La cuenta contable del banco en el PCGE, p.ej. 1041118. */
  codCuentaContable: string;

  formaPago: string;

  /** Lo que se lee en el combo, ya armado. */
  etiqueta: string;
}
