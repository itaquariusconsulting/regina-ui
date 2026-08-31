import jsPDF from 'jspdf';

/**
 * El armado común de los PDF de reportes: marca, filtros usados, tarjetas de
 * resumen, tabla y pie con la paginación.
 *
 * Existe para que los reportes salgan iguales entre sí. La alternativa —copiar
 * el dibujo en cada pantalla— garantiza que en un mes haya cinco variantes:
 * alguien corrige un margen en una y las otras cuatro quedan viejas.
 *
 * Los filtros se imprimen siempre, y no es decoración: un PDF que circula por
 * correo sin decir con qué filtros salió no se puede volver a citar dos semanas
 * después, y alguien termina discutiendo dos cifras que respondían a preguntas
 * distintas.
 */

export type Alineacion = 'l' | 'r' | 'c';

export interface ColumnaPdf {
  titulo: string;
  ancho: number;
  alineacion?: Alineacion;
}

export interface TarjetaPdf {
  rotulo: string;
  valor: string;
  pie?: string;
  color?: [number, number, number];
}

export interface CabeceraPdf {
  /** Qué reporte es. Va arriba a la derecha. */
  reporte: string;
  empresa: string;
  usuario?: string;
}

const AZUL: [number, number, number] = [37, 78, 138];
const GRIS: [number, number, number] = [110, 118, 130];
const LINEA: [number, number, number] = [222, 226, 232];
const TINTA: [number, number, number] = [40, 44, 52];

export class ReportePdf {

  private readonly doc: jsPDF;
  private readonly ancho: number;
  private readonly alto: number;
  private readonly margen = 28;
  private y: number;

  constructor(orientacion: 'portrait' | 'landscape' = 'landscape') {
    this.doc = new jsPDF({ orientation: orientacion, unit: 'pt', format: 'a4' });
    this.ancho = this.doc.internal.pageSize.getWidth();
    this.alto = this.doc.internal.pageSize.getHeight();
    this.y = this.margen;
  }

  private get derecha(): number { return this.ancho - this.margen; }

  // ---------------------------------------------------------- cabecera

  cabecera(c: CabeceraPdf): this {
    const d = this.doc;
    const y = this.y;

    d.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
    d.roundedRect(this.margen, y, 26, 26, 4, 4, 'F');
    d.setTextColor(255, 255, 255);
    d.setFont('helvetica', 'bold');
    d.setFontSize(15);
    d.text('R', this.margen + 9, y + 18);

    d.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
    d.text('REGINA', this.margen + 34, y + 12);
    d.setFont('helvetica', 'normal');
    d.setFontSize(7.5);
    d.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    d.text('Rendición de cuentas', this.margen + 34, y + 22);

    const pares: Array<[string, string]> = [
      ['Reporte: ', c.reporte],
      ['Empresa: ', c.empresa],
      ['Generado: ', new Date().toLocaleString('es-PE')],
      ['Usuario: ', c.usuario || '—'],
    ];

    d.setFontSize(8);
    pares.forEach((par, i) => {
      const linY = y + 6 + i * 10;
      const anchoValor = d.getTextWidth(par[1]);
      d.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      d.text(par[0], this.derecha - anchoValor - d.getTextWidth(par[0]), linY);
      d.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
      d.setFont('helvetica', 'bold');
      d.text(par[1], this.derecha - anchoValor, linY);
      d.setFont('helvetica', 'normal');
    });

    this.y = y + 40;
    d.setDrawColor(AZUL[0], AZUL[1], AZUL[2]);
    d.setLineWidth(1);
    d.line(this.margen, this.y, this.derecha, this.y);
    this.y += 16;
    return this;
  }

  /** Los filtros aplicados, como píldoras. Si no hay ninguno se dice también. */
  filtros(lista: string[]): this {
    const d = this.doc;
    const chips = lista.length ? lista : ['sin filtros: todo el período'];
    let x = this.margen;
    d.setFontSize(7.5);

    for (const chip of chips) {
      const w = d.getTextWidth(chip) + 14;
      if (x + w > this.derecha) { x = this.margen; this.y += 18; }
      d.setFillColor(243, 245, 248);
      d.roundedRect(x, this.y - 9, w, 15, 7, 7, 'F');
      d.setTextColor(70, 78, 92);
      d.text(chip, x + 7, this.y + 1);
      x += w + 6;
    }
    this.y += 24;
    return this;
  }

  tarjetas(lista: TarjetaPdf[]): this {
    if (!lista.length) { return this; }
    const d = this.doc;
    const separacion = 10;
    const anchoT = (this.derecha - this.margen - (lista.length - 1) * separacion) / lista.length;
    const alto = lista.some(t => t.pie) ? 50 : 40;

    lista.forEach((t, i) => {
      const color = t.color ?? AZUL;
      const tx = this.margen + i * (anchoT + separacion);

      d.setDrawColor(LINEA[0], LINEA[1], LINEA[2]);
      d.setLineWidth(0.6);
      d.roundedRect(tx, this.y, anchoT, alto, 3, 3, 'S');
      d.setFillColor(color[0], color[1], color[2]);
      d.rect(tx, this.y, anchoT, 2.5, 'F');

      d.setFontSize(6.5);
      d.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      d.text(t.rotulo, tx + 10, this.y + 16);

      d.setFontSize(16);
      d.setFont('helvetica', 'bold');
      d.setTextColor(color[0], color[1], color[2]);
      d.text(t.valor, tx + 10, this.y + 34);
      d.setFont('helvetica', 'normal');

      if (t.pie) {
        d.setFontSize(6.5);
        d.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
        d.text(t.pie, tx + 10, this.y + 45);
      }
    });

    this.y += alto + 14;
    return this;
  }

  seccion(titulo: string): this {
    const d = this.doc;
    this.saltarSiNoEntra(30);
    d.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
    d.rect(this.margen, this.y - 8, 3, 11, 'F');
    d.setFontSize(10);
    d.setFont('helvetica', 'bold');
    d.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
    d.text(titulo, this.margen + 9, this.y);
    d.setFont('helvetica', 'normal');
    this.y += 12;
    return this;
  }

  /**
   * Una tabla. La cabecera se vuelve a dibujar en cada página: sin eso, a la
   * segunda hoja ya no se sabe qué es cada número.
   */
  tabla(columnas: ColumnaPdf[], filas: string[][], total?: string[]): this {
    const d = this.doc;

    const dibujarCabecera = () => {
      d.setFillColor(AZUL[0], AZUL[1], AZUL[2]);
      d.rect(this.margen, this.y, this.derecha - this.margen, 16, 'F');
      d.setTextColor(255, 255, 255);
      d.setFontSize(7);
      d.setFont('helvetica', 'bold');
      let cx = this.margen;
      for (const c of columnas) {
        this.celda(c.titulo, cx, this.y + 11, c.ancho, c.alineacion ?? 'l');
        cx += c.ancho;
      }
      d.setFont('helvetica', 'normal');
      this.y += 16;
      d.setFontSize(6.8);
    };

    dibujarCabecera();
    let impar = false;

    for (const fila of filas) {
      if (this.y > this.alto - 60) {
        d.addPage();
        this.y = this.margen;
        dibujarCabecera();
      }

      if (impar) {
        d.setFillColor(248, 250, 252);
        d.rect(this.margen, this.y, this.derecha - this.margen, 13, 'F');
      }
      impar = !impar;

      let cx = this.margen;
      d.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
      fila.forEach((v, i) => {
        const c = columnas[i];
        if (!c) { return; }
        this.celda(v ?? '', cx, this.y + 9, c.ancho, c.alineacion ?? 'l');
        cx += c.ancho;
      });

      d.setDrawColor(LINEA[0], LINEA[1], LINEA[2]);
      d.setLineWidth(0.3);
      d.line(this.margen, this.y + 13, this.derecha, this.y + 13);
      this.y += 13;
    }

    if (total) {
      this.saltarSiNoEntra(30);
      d.setFillColor(232, 239, 249);
      d.rect(this.margen, this.y, this.derecha - this.margen, 16, 'F');
      d.setFont('helvetica', 'bold');
      d.setFontSize(7.2);
      d.setTextColor(AZUL[0], AZUL[1], AZUL[2]);
      let cx = this.margen;
      total.forEach((v, i) => {
        const c = columnas[i];
        if (!c) { return; }
        this.celda(v ?? '', cx, this.y + 11, c.ancho, c.alineacion ?? 'l');
        cx += c.ancho;
      });
      d.setFont('helvetica', 'normal');
      this.y += 20;
    }

    return this;
  }

  /** Una línea de texto suelta, para notas al pie de una sección. */
  nota(texto: string): this {
    this.saltarSiNoEntra(24);
    this.doc.setFontSize(7);
    this.doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    this.doc.text(texto, this.margen, this.y);
    this.y += 14;
    return this;
  }

  guardar(nombre: string): void {
    const paginas = this.doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      this.doc.text(`Página ${i} de ${paginas}`,
        this.ancho / 2, this.alto - 18, { align: 'center' });
    }
    this.doc.save(nombre);
  }

  // ------------------------------------------------------------ apoyo

  private saltarSiNoEntra(alto: number): void {
    if (this.y + alto > this.alto - 40) {
      this.doc.addPage();
      this.y = this.margen;
    }
  }

  private celda(valor: string, x: number, y: number, ancho: number, al: Alineacion): void {
    if (al === 'r') {
      this.doc.text(valor, x + ancho - 5, y, { align: 'right' });
    } else if (al === 'c') {
      this.doc.text(valor, x + ancho / 2, y, { align: 'center' });
    } else {
      this.doc.text(valor, x + 5, y);
    }
  }
}

/** Un número con dos decimales, como se escribe en Perú. */
export function nro(v?: number): string {
  return (v ?? 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

/** Una fecha corta, o vacío si no hay. */
export function fecha(v?: string | Date | null): string {
  if (!v) { return ''; }
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE');
}
