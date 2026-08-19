import { parseNroComprobante, formatearNroDocumento } from './comprobante-numero.util';

const TEXTO_FACTURA = `
DONDE WALTER - SURCO
MARGAL INVERSIONES S.A.C.
Av. Camino del Inca 1478 Urb. Chacarilla
LIMA-LIMA-SANTIAGO DE SURCO
                          FACTURA ELECTRONICA
                          RUC: 20600775317
                          F002-11092
Fecha de Emision : 19/08/2026
Tipo de Moneda : SOL
Cantidad UNIDAD 0000036 Jarra de Limonada de la Casa (1 Lt.) 17.66
`;

const TEXTO_BOLETA = `
POLLERIA EL RANCHO
R.U.C. 10456789012
BOLETA DE VENTA ELECTRONICA
B001 N 00000345
FECHA: 01/08/2026  HORA: 13:45
MESA 12  CAJA 03
TOTAL S/ 85.00
`;

const TEXTO_OCR_SUCIO = `
FACTURA ELECTRONICA
RUC 20600775317
FOO2 - OOOO11O92
TOTAL 404.00
`;

describe('parseNroComprobante', () => {

  const casos: Array<[string, string, string | null, string, string]> = [
    ['guion simple',            'F002-11092',                 null,      'F002', '11092'],
    ['ceros a la izquierda',    'F002 - 000011092',           null,      'F002', '11092'],
    ['guion largo',             'F002– 11092',           null,      'F002', '11092'],
    ['raya',                    'F002—11092',            null,      'F002', '11092'],
    ['etiqueta N grado',        'F002 N° 11092',         null,      'F002', '11092'],
    ['etiqueta Nro.',           'F002 Nro. 11092',            null,      'F002', '11092'],
    ['etiqueta NUMERO',         'F002 NUMERO 11092',          null,      'F002', '11092'],
    ['serie pegada al numero',  'F00211092',                  null,      'F002', '11092'],
    ['salto de linea',          'F002\n11092',                null,      'F002', '11092'],
    ['dos espacios',            'F002  11092',                null,      'F002', '11092'],
    ['minusculas',              'f002-11092',                 null,      'F002', '11092'],
    ['con espacios alrededor',  '  F002-11092  ',             null,      'F002', '11092'],
    ['letra O por cero',        'FOO2-11092',                 null,      'F002', '11092'],
    ['punto de miles',          'F002-11.092',                null,      'F002', '11092'],
    ['espacio de miles',        'F002-11 092',                null,      'F002', '11092'],
    ['padding a 15',            'F002-000000000011092',       null,      'F002', '11092'],
    ['etiquetas separadas',     'SERIE: F002 NUMERO: 11092',  null,      'F002', '11092'],
    ['frase completa',          'Serie y numero: F002-11092', null,      'F002', '11092'],
    ['prefijo N grado',         'N° F002-11092',         null,      'F002', '11092'],
    ['boleta',                  'B001-00000345',              'BOLETA',  'B001', '345'],
    ['serie con dos letras',    'EB01-1234',                  null,      'EB01', '1234'],
    ['serie FF01',              'FF01-123',                   null,      'FF01', '123'],
    ['correlativo de un digito','E001-9',                     null,      'E001', '9'],
    ['serie fisica de 3',       '001-0001234',                null,      '001',  '1234'],
    ['serie fisica de 4',       '0001-00012345',              null,      '0001', '12345'],
    ['I por 1',                 'F002-1I092',                 null,      'F002', '11092'],
    ['O por 0',                 'F002-11O92',                 null,      'F002', '11092'],
    ['S por 5',                 'F002-S5555',                 null,      'F002', '55555'],
    ['texto OCR de factura',    TEXTO_FACTURA,                'FACTURA', 'F002', '11092'],
    ['texto OCR de boleta',     TEXTO_BOLETA,                 'BOLETA',  'B001', '345'],
    ['texto OCR sucio',         TEXTO_OCR_SUCIO,              'FACTURA', 'F002', '11092'],
  ];

  casos.forEach(([nombre, entrada, tipo, serie, numero]) => {
    it(`resuelve ${nombre}`, () => {
      const r = parseNroComprobante(entrada, tipo);
      expect(r.ok).withContext(r.advertencias.join('; ')).toBeTrue();
      expect(r.serie).toBe(serie);
      expect(r.numero).toBe(numero);
    });
  });

  const negativos: Array<[string, string]> = [
    ['cadena vacia', ''],
    ['solo espacios', '   '],
    ['solo un RUC', 'RUC: 20600775317'],
    ['solo una fecha', '19-08-2026'],
    ['solo un importe', 'TOTAL S/ 404.00'],
    ['texto libre', 'Jarra de Limonada de la Casa'],
    ['correlativo imposible', 'F002-1234567890123'],
  ];

  negativos.forEach(([nombre, entrada]) => {
    it(`no inventa nada con ${nombre}`, () => {
      const r = parseNroComprobante(entrada);
      expect(r.ok).toBeFalse();
      expect(r.serie).toBe('');
      expect(r.numero).toBe('');
    });
  });

  it('acepta null y undefined sin lanzar', () => {
    expect(parseNroComprobante(null).ok).toBeFalse();
    expect(parseNroComprobante(undefined).ok).toBeFalse();
  });

  it('marca como reparado cuando corrige caracteres del OCR', () => {
    const r = parseNroComprobante('FOO2-11O92');
    expect(r.reparado).toBeTrue();
    expect(r.advertencias.length).toBeGreaterThan(0);
  });

  it('devuelve el correlativo sin ceros para SUNAT y con ceros para el campo', () => {
    const r = parseNroComprobante('F002-000000000011092');
    expect(r.numero).toBe('11092');
    expect(r.numeroPadded).toBe('000000000011092');
    expect(r.formateado).toBe('F002-000000000011092');
  });
});

describe('formatearNroDocumento', () => {

  it('normaliza lo que el usuario tipeo', () => {
    expect(formatearNroDocumento('f002 11092')).toBe('F002-000000000011092');
    expect(formatearNroDocumento('F00211092')).toBe('F002-000000000011092');
  });

  it('respeta lo tipeado si no se puede interpretar', () => {
    expect(formatearNroDocumento('no se lee')).toBe('NO SE LEE');
    expect(formatearNroDocumento('')).toBe('');
  });
});
