/**
 * Las reglas de fecha de un comprobante, en un solo lugar.
 *
 * El número vive acá y no en cada pantalla porque ya iba por el tercer lugar
 * donde había que escribirlo: la carga de comprobantes, la planilla de
 * movilidad y el backend. Repetido, el día que contabilidad diga diez días
 * alguien cambia dos de los tres y nadie se entera hasta que un usuario
 * reclama.
 *
 * El backend tiene el mismo número en RendicionService.DIAS_ANTES_TOLERADOS y
 * es el que manda sobre lo que se guarda; este decide lo que la pantalla
 * muestra y permite.
 */
export const DIAS_ANTES_TOLERADOS = 5;

/**
 * El día más antiguo que se acepta para un comprobante de esa orden de pago.
 *
 * La gente adelanta gastos: paga el pasaje o el hotel unos días antes de que
 * salga la orden. Devuelve null si todavía no se conoce la fecha de la OP.
 */
export function fechaMinimaAceptada(fecOrden?: string | Date | null): Date | null {
  if (!fecOrden) { return null; }
  const limite = new Date(fecOrden);
  if (isNaN(limite.getTime())) { return null; }
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - DIAS_ANTES_TOLERADOS);
  return limite;
}
