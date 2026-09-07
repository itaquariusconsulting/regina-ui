import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DocumentoService } from '../../services/documento.service';
import { PdfViewerComponent } from '../pdf-viewer/pdf-viewer.component';

/**
 * Lo que hace falta para ir a buscar un escaneo.
 *
 * Los archivos viven en {tipo}/{anio}/{mes} y el nombre va SIN extension: el
 * backend prueba las que conoce hasta dar con el archivo. Es la misma
 * convencion que usa la pantalla del usuario, no una nueva.
 */
export interface VisorDocumentoData {
  tipo: string;
  anio: string;
  mes: string;
  /** Sin extension. */
  nombre: string;
  titulo: string;
  subtitulo?: string;
}

/**
 * El escaneo de un comprobante, una planilla o un voucher, en grande.
 *
 * <p>Nace porque contabilidad va a aprobar documentos y hasta ahora los
 * revisaba sin poder abrirlos: la pantalla tenia la ruta del archivo pero
 * ningun sitio donde mostrarlo. Aprobar sin ver el papel es firmar a ciegas.
 *
 * <p>Va en un dialogo y no dentro de la fila de la tabla a proposito. Un
 * voucher de deposito metido en una celda se lee mal, y si contabilidad no
 * puede leer el numero de operacion termina abriendo el ERP en otra pestana
 * que es justo lo que se quiere evitar.
 *
 * <p>Dos formatos y un solo camino: si los primeros bytes son %PDF va al
 * visor de PDF.js, si no se muestra como imagen. Se mira el contenido y no
 * la extension porque el backend sirve el archivo sin decir cual es.
 */
@Component({
  selector: 'app-visor-documento-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, PdfViewerComponent],
  template: `
    <div class="vd-cabecera">
      <div class="vd-titulo">
        <h6>{{ data.titulo }}</h6>
        <small *ngIf="data.subtitulo">{{ data.subtitulo }}</small>
      </div>
      <button type="button" class="general-button btn-secondary btn-sm"
              (click)="cerrar()" title="Cerrar">
        <i class="fa fa-xmark"></i>
      </button>
    </div>

    <div class="vd-cuerpo">
      <div class="vd-estado" *ngIf="cargando">
        <i class="fa fa-spinner fa-spin"></i> Abriendo el documento...
      </div>

      <div class="vd-estado vd-error" *ngIf="!cargando && error">
        <i class="fa fa-triangle-exclamation"></i>
        <div>
          <strong>{{ error }}</strong>
          <div class="vd-pista">{{ rutaLegible }}</div>
        </div>
      </div>

      <app-pdf-viewer *ngIf="!cargando && !error && pdfUrl" [src]="pdfUrl"></app-pdf-viewer>

      <img class="vd-imagen" *ngIf="!cargando && !error && imagenUrl"
           [src]="imagenUrl" [alt]="data.titulo" />
    </div>
  `,
  styles: [`
    :host { display: block; }

    .vd-cabecera {
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem; padding: .85rem 1.1rem;
      border-bottom: 1px solid #e3e6ec; background: #f8f9fb;
    }
    .vd-titulo h6 { margin: 0; font-weight: 600; }
    .vd-titulo small { color: #6c757d; }

    /* Alto fijo para que el visor no salte de tamano al cambiar de pagina
       ni al pasar de un PDF de una hoja a uno de veinte. */
    .vd-cuerpo {
      height: 74vh; overflow: auto; background: #525659;
      display: flex; align-items: flex-start; justify-content: center;
    }

    .vd-estado {
      display: flex; align-items: center; gap: .6rem;
      margin: auto; padding: 1.5rem; color: #fff; text-align: center;
    }
    .vd-error { color: #ffd9d9; }
    .vd-pista { font-size: .78rem; color: #c9ccd1; margin-top: .3rem; }

    .vd-imagen { max-width: 100%; height: auto; margin: auto; display: block; }

    app-pdf-viewer { width: 100%; }
  `]
})
export class VisorDocumentoDialogComponent implements OnInit, OnDestroy {

  cargando = true;
  error = '';

  pdfUrl?: string;
  imagenUrl?: string;

  /** Se guarda para poder revocarlo al cerrar y no dejar memoria colgada. */
  private objectUrl?: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: VisorDocumentoData,
    private dialogRef: MatDialogRef<VisorDocumentoDialogComponent>,
    private documentoService: DocumentoService
  ) {}

  get rutaLegible(): string {
    return this.data.tipo + '/' + this.data.anio + '/' + this.data.mes + '/' + this.data.nombre;
  }

  ngOnInit(): void {
    this.documentoService
      .viewDocumento(this.data.tipo, this.data.anio, this.data.mes, this.data.nombre)
      .subscribe({
        next: async (blob: Blob) => {
          // Un blob vacio no es un archivo: algunos servidores responden 200
          // con cero bytes cuando el archivo no esta, y sin esto el visor se
          // quedaria en blanco sin decir por que.
          if (!blob || blob.size === 0) {
            this.fallar('El archivo esta vacio o no se pudo leer.');
            return;
          }

          if (await this.esPdf(blob)) {
            this.objectUrl = URL.createObjectURL(blob);
            this.pdfUrl = this.objectUrl;
          } else {
            this.imagenUrl = await this.comoDataUrl(blob);
          }
          this.cargando = false;
        },
        error: () => this.fallar('No se encontro el archivo escaneado.')
      });
  }

  ngOnDestroy(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  private fallar(mensaje: string): void {
    this.error = mensaje;
    this.cargando = false;
  }

  /** Los primeros cuatro bytes: %PDF. Mas fiable que mirar la extension. */
  private async esPdf(blob: Blob): Promise<boolean> {
    try {
      const cabecera = await blob.slice(0, 4).arrayBuffer();
      const bytes = new Uint8Array(cabecera);
      return bytes[0] === 0x25 && bytes[1] === 0x50
          && bytes[2] === 0x44 && bytes[3] === 0x46;
    } catch {
      return false;
    }
  }

  private comoDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolver) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result as string);
      lector.onerror = () => resolver('');
      lector.readAsDataURL(blob);
    });
  }
}
