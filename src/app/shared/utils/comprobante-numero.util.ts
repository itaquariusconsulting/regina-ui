/**
 * comprobante-numero.util.ts
 * ---------------------------------------------------------------------------
 * Extraccion robusta de SERIE y NUMERO de un comprobante de pago peruano.
 *
 * Es el gemelo en TypeScript de app/core/doc_number.py del OCR
 * (regina-ai-ocr). Ambos cubren la misma casuistica y devuelven el mismo
 * resultado, para que el numero que arma el OCR y el que valida el frontend
 * nunca discrepen.
 *
 * CASUISTICA CUBIERTA
 *  1. Separadores:     F002-11092 | F002 - 11092 | F002–11092 (guion largo)
 *  2. Etiquetas:       F002 N° 11092 | F002 Nro. 11092 | SERIE F002 NUMERO 11092
 *  3. Sin separador:   F00211092
 *  4. Salto de linea:  "F002\n11092"
 *  5. Ceros a la izq.: F002-000011092 -> 11092
 *  6. Ruido:           F002-11.092 | F002-11 092
 *  7. Confusiones OCR: O/Q/D->0, I/L->1, Z->2, S->5, G->6, T->7, B->8
 *  8. Serie fisica:    001-0001234
 *  9. Texto completo:  elige el mejor candidato por puntaje
 * 10. Falsos positivos: descarta RUC, fechas, importes, telefonos
 *
 * LIMITES SUNAT: serie = 1 letra + 3 alfanumericos (o 3-4 digitos si es
 * fisica); correlativo = hasta 8 digitos SIN ceros a la izquierda.
 */

/** Largo maximo del correlativo que acepta SUNAT. */
export const MAX_LARGO_NUMERO = 8;

/** Largo al que el sistema rellena el numero para mostrarlo/guardarlo. */
export const LARGO_PADDING = 15;

const LETRAS_SERIE_VALIDAS = new Set(['F', 'B', 'E', 'R', 'T', 'N', 'P', 'G', 'C']);

const LETRA_POR_TIPO: Record<string, Set<string>> = {
  'FACTURA': new Set(['F', 'E']),
  'BOLETA': new Set(['B', 'E']),
  'NOTA DE CREDITO': new Set(['F', 'B', 'E']),
  'NOTA DE DEBITO': new Set(['F', 'B', 'E']),
  'RECIBO': new Set(['R', 'E']),
};

/** Confusiones tipicas del OCR donde deberia haber un DIGITO. */
const CONFUSION_A_DIGITO: Record<string, string> = {
  O: '0', Q: '0', D: '0', U: '0',
  I: '1', L: '1', '|': '1', '!': '1', ']': '1', '[': '1',
  Z: '2',
  E: '3',
  A: '4',
  S: '5', $: '5',
  G: '6', C: '6',
  T: '7', '?': '7',
  B: '8', '&': '8',
  P: '9',
};

/**
 * Confusiones que SI se corrigen dentro de la serie. Subconjunto chico a
 * proposito: series como FF01, EB01 o BB01 son legitimas, asi que B, S, G o T
 * nunca se tocan ahi.
 */
const CONFUSION_SERIE: Record<string, string> = {
  O: '0', Q: '0', D: '0', I: '1', L: '1', '|': '1',
};

/** Caracteres que se ignoran dentro de la parte numerica. */
const RUIDO_NUMERICO = new Set([' ', '.', ',', "'", '`', '·', '-', '_', '/', '\\']);

const PREFIJOS_PROHIBIDOS = [
  'RUC', 'DNI', 'TELF', 'TELEFONO', 'CEL', 'CELULAR', 'CUENTA', 'CTA', 'CCI',
  'IGV', 'TOTAL', 'SUBTOTAL', 'FECHA', 'HORA', 'CAJA', 'MESA', 'PEDIDO',
  'ORDEN', 'GUIA',
];

const PALABRAS_TITULO = [
  'FACTURA', 'BOLETA', 'NOTA DE CREDITO', 'NOTA DE DEBITO', 'RECIBO',
  'COMPROBANTE', 'ELECTRONICA', 'SERIE',
];

/** Resultado del parseo. */
export interface NroComprobante {
  /** Serie normalizada, p.ej. "F002". Vacio si no se encontro. */
  serie: string;
  /** Correlativo SIN ceros a la izquierda — es lo que espera la API de SUNAT. */
  numero: string;
  /** Correlativo relleno a 15 digitos — formato interno del sistema. */
  numeroPadded: string;
  /** "F002-000000000011092", listo para el campo Nro. Documento. */
  formateado: string;
  /** Puntaje del candidato elegido (0-100). */
  confianza: number;
  /** Que regla lo encontro. */
  patron: string;
  /** true si hubo que corregir caracteres mal leidos por el OCR. */
  reparado: boolean;
  /** Mensajes para mostrar o loguear. */
  advertencias: string[];
  /** Fragmento original que se matcheo. */
  crudo: string;
  /** true si serie y numero estan completos. */
  ok: boolean;
}

function vacio(advertencia: string, crudo = ''): NroComprobante {
  return {
    serie: '', numero: '', numeroPadded: '', formateado: '',
    confianza: 0, patron: '', reparado: false,
    advertencias: [advertencia], crudo, ok: false,
  };
}

// ---------------------------------------------------------------------------
// Normalizacion
// ---------------------------------------------------------------------------

const GUIONES_UNICODE = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00ad]/g;

/** Mayusculas, sin tildes, guiones unicode a "-", etiquetas a "N#". */
export function normalizarTexto(texto: string): string {
  if (!texto) { return ''; }
  let t = String(texto).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  t = t.replace(GUIONES_UNICODE, '-');
  t = t.replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\t/g, ' ');
  t = t.toUpperCase();
  t = t.replace(/\bN\s*[°º*]\s*/g, 'N# ');
  t = t.replace(/\bNRO\s*\.?\s*/g, 'N# ');
  t = t.replace(/\bNUM(?:ERO)?\s*\.?\s*/g, 'N# ');
  t = t.replace(/\bN\s*\.\s*(?=[A-Z0-9])/g, 'N# ');
  t = t.replace(/\bN\b\s*[.:]?\s*(?=[0-9OQDUILZEASGCTB]{3})/g, 'N# ');
  return t;
}

/** Convierte a digitos, corrigiendo confusiones; corta ante lo imposible. */
function repararDigitos(fragmento: string): { valor: string; reparado: boolean } {
  let valor = '';
  let reparado = false;
  for (const ch of fragmento) {
    if (RUIDO_NUMERICO.has(ch)) { continue; }
    if (ch >= '0' && ch <= '9') { valor += ch; continue; }
    const mapeado = CONFUSION_A_DIGITO[ch];
    if (mapeado) { valor += mapeado; reparado = true; } else { break; }
  }
  return { valor, reparado };
}

/** Limpia la serie y corrige la cabeza si el OCR puso un digito por letra. */
function repararSerie(fragmento: string): { valor: string; reparado: boolean } {
  const limpio = fragmento.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!limpio) { return { valor: '', reparado: false }; }
  if (/^\d+$/.test(limpio)) { return { valor: limpio, reparado: false }; }

  let cabeza = limpio[0];
  const cola = limpio.slice(1);
  let reparado = false;

  if (cabeza >= '0' && cabeza <= '9') {
    const inverso: Record<string, string> = { '0': 'O', '8': 'B', '5': 'S', '1': 'I', '6': 'G', '7': 'T' };
    const letra = inverso[cabeza];
    if (letra && LETRAS_SERIE_VALIDAS.has(letra)) { cabeza = letra; reparado = true; }
  }
  return { valor: cabeza + cola, reparado };
}

/** Segunda pasada: FOO2 -> F002 (solo con las confusiones seguras). */
function corregirSerieAmbigua(serie: string): { valor: string; reparado: boolean } {
  if (serie.length < 2 || /^\d+$/.test(serie)) { return { valor: serie, reparado: false }; }
  const cabeza = serie[0];
  const cola = serie.slice(1);
  if (/^\d+$/.test(cola)) { return { valor: serie, reparado: false }; }
  const convertida = cola.split('').map(c => CONFUSION_SERIE[c] ?? c).join('');
  if (/^\d+$/.test(convertida)) { return { valor: cabeza + convertida, reparado: true }; }
  return { valor: serie, reparado: false };
}

// ---------------------------------------------------------------------------
// Patrones
// ---------------------------------------------------------------------------

const CI = '0-9OQDUILZEASGCTB|!$&';        // interior de la clase "digito tolerante"
const C = `[${CI}]`;
const NUM = `${C}[${CI} .,]{0,19}`;
const SERIE = '[A-Z][A-Z0-9]{2,3}';

interface Patron { nombre: string; re: RegExp; base: number; }

const PATRONES: Patron[] = [
  { nombre: 'serie-guion-numero', re: new RegExp(`\\b(${SERIE})\\s*-\\s*(${NUM})`, 'g'), base: 100 },
  { nombre: 'serie-etiqueta-numero', re: new RegExp(`\\b(${SERIE})\\s*N#[\\s:.\\-]*(${NUM})`, 'g'), base: 95 },
  { nombre: 'etiqueta-serie-numero', re: new RegExp(`\\bSERIE\\s*[:.]?\\s*(${SERIE})[^0-9]{0,16}?(${NUM})`, 'g'), base: 95 },
  { nombre: 'serie-espacio-numero', re: new RegExp(`\\b(${SERIE})[ \\n\\r]+(${C}{3,19})\\b`, 'g'), base: 75 },
  { nombre: 'serie-pegada-numero', re: new RegExp(`\\b([A-Z][A-Z0-9]{3})(${C}{4,15})\\b`, 'g'), base: 70 },
  { nombre: 'serie-fisica', re: new RegExp('\\b(\\d{3,4})\\s*-\\s*(\\d{4,15})\\b', 'g'), base: 60 },
];

const RE_FECHA = /\d{1,2}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{2,4}/;
const RE_SERIE_VALIDA = /^(?:[A-Z][A-Z0-9]{1,2}\d|\d{3,4})$/;

function contexto(texto: string, ini: number, fin: number, radio: number): string {
  return texto.slice(Math.max(0, ini - radio), Math.min(texto.length, fin + radio));
}

function esFalsoPositivo(texto: string, ini: number, fin: number,
                         serie: string, numeroBruto: string): string | null {
  const previo = texto.slice(Math.max(0, ini - 24), ini).replace(/[.: ]/g, '');
  for (const palabra of PREFIJOS_PROHIBIDOS) {
    if (previo.endsWith(palabra)) { return `precedido por ${palabra}`; }
  }
  if (numeroBruto.length === 11 && /^(10|15|17|20)/.test(numeroBruto)) {
    return 'parece un RUC';
  }
  if (RE_FECHA.test(contexto(texto, ini, fin, 6)) && /^\d+$/.test(serie)) {
    return 'parece una fecha';
  }
  if (ini > 0 && /\d/.test(texto[ini - 1])) { return 'pegado a otro numero'; }
  if (fin < texto.length && /\d/.test(texto[fin]) && numeroBruto.length >= MAX_LARGO_NUMERO) {
    return 'correlativo demasiado largo';
  }
  return null;
}

function puntuar(base: number, texto: string, ini: number, fin: number, serie: string,
                 numero: string, reparado: boolean, tipoDoc?: string | null): number {
  let p = base;

  if (serie && LETRAS_SERIE_VALIDAS.has(serie[0])) { p += 12; }
  else if (/^\d+$/.test(serie)) { p -= 5; }

  if (tipoDoc) {
    const esperadas = LETRA_POR_TIPO[tipoDoc.toUpperCase().trim()];
    if (esperadas && serie && esperadas.has(serie[0])) { p += 12; }
    else if (esperadas && serie && !/^\d+$/.test(serie)) { p -= 8; }
  }

  const ventana = contexto(texto, ini, fin, 60);
  if (PALABRAS_TITULO.some(w => ventana.includes(w))) { p += 10; }

  if (serie.length === 4) { p += 8; } else if (serie.length === 3) { p -= 6; }

  p += (numero.length >= 1 && numero.length <= MAX_LARGO_NUMERO) ? 6 : -30;
  if (reparado) { p -= 12; }
  if (ini < 400) { p += 5; }

  return p;
}

function extraerCandidatos(texto: string, tipoDoc?: string | null): NroComprobante[] {
  const candidatos: NroComprobante[] = [];

  for (const { nombre, re, base } of PATRONES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }

      const s1 = repararSerie(m[1]);
      const s2 = corregirSerieAmbigua(s1.valor);
      const serie = s2.valor;
      const num = repararDigitos(m[2]);
      const numeroBruto = num.valor;
      if (!serie || !numeroBruto) { continue; }

      const numero = numeroBruto.replace(/^0+/, '') || '0';
      const ini = m.index;
      const fin = m.index + m[0].length;

      if (esFalsoPositivo(texto, ini, fin, serie, numeroBruto)) { continue; }
      if (numero.length > MAX_LARGO_NUMERO) { continue; }
      if (!RE_SERIE_VALIDA.test(serie)) { continue; }

      const reparado = s1.reparado || s2.reparado || num.reparado;
      const advertencias: string[] = [];
      if (reparado) {
        advertencias.push(`se corrigieron caracteres del OCR ('${m[0].trim()}')`);
      }
      if (serie.length === 3) {
        advertencias.push('la serie tiene 3 caracteres; SUNAT usa 4');
      }

      candidatos.push({
        serie,
        numero,
        numeroPadded: numero.padStart(LARGO_PADDING, '0'),
        formateado: `${serie}-${numero.padStart(LARGO_PADDING, '0')}`,
        confianza: puntuar(base, texto, ini, fin, serie, numero, reparado, tipoDoc),
        patron: nombre,
        reparado,
        advertencias,
        crudo: m[0].trim(),
        ok: true,
      });
    }
  }
  return candidatos;
}

// ---------------------------------------------------------------------------
// API publica
// ---------------------------------------------------------------------------

/**
 * Devuelve la serie y el numero encontrados en `entrada`, que puede ser el
 * texto completo del OCR o lo que el usuario tipeo en el campo.
 * Nunca lanza: si no encuentra nada devuelve `ok: false` y el motivo.
 */
export function parseNroComprobante(entrada: string | null | undefined,
                                    tipoDoc?: string | null): NroComprobante {
  if (!entrada || !String(entrada).trim()) {
    return vacio('no se recibio ningun texto');
  }

  const texto = normalizarTexto(String(entrada));
  const candidatos = extraerCandidatos(texto, tipoDoc);

  if (!candidatos.length) {
    return vacio('no se encontro un patron serie-numero en el texto', texto.slice(0, 80));
  }

  candidatos.sort((a, b) => (b.confianza - a.confianza)
    || (b.serie.length - a.serie.length)
    || (a.numero.length - b.numero.length));

  const mejor = candidatos[0];

  const distinto = candidatos.slice(1).find(
    c => c.serie !== mejor.serie || c.numero !== mejor.numero);
  if (distinto && (mejor.confianza - distinto.confianza) <= 8) {
    mejor.advertencias.push(
      `habia otro candidato posible: ${distinto.serie}-${distinto.numero}`);
  }

  mejor.confianza = Math.max(0, Math.min(100, mejor.confianza));
  return mejor;
}

/**
 * Normaliza lo que el usuario tipeo al formato interno SERIE-000000000000001.
 * Si no se puede interpretar, devuelve el valor original tal cual (para no
 * borrarle lo que escribio).
 */
export function formatearNroDocumento(valor: string | null | undefined,
                                      tipoDoc?: string | null): string {
  const r = parseNroComprobante(valor, tipoDoc);
  return r.ok ? r.formateado : (valor ?? '').toString().trim().toUpperCase();
}
