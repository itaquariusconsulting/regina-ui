import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Visor PDF embebido basado en PDF.js (Mozilla).
 *
 * Se carga el script de PDF.js dinámicamente desde el CDN de Cloudflare la
 * primera vez que se usa, así NO requiere `npm install` ni Adobe Reader
 * instalado en el sistema. Renderiza el PDF en un <canvas> nativo del
 * navegador, lo que funciona en CUALQUIER plataforma: Windows sin Adobe,
 * Linux, macOS, iOS Safari, Android Chrome, etc.
 *
 * Controles incluidos:
 *  - ⬅ ➡  navegación entre páginas
 *  - 🔍 ➕ ➖  zoom in / out
 *  - 📐  ajustar al ancho
 *  - 🔄  rotación 90°
 *  - ⤓  descargar PDF
 *  - 🖨  imprimir
 *
 * Uso típico:
 *   <app-pdf-viewer [src]="pdfUrl"></app-pdf-viewer>
 *
 * `src` acepta:
 *   - data: URL (formato base64 → "data:application/pdf;base64,...")
 *   - blob: URL  (URL.createObjectURL(file))
 *   - URL HTTPS pública (CORS debe permitirla)
 *   - ArrayBuffer / Uint8Array
 */
@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pdf-viewer-host">
      <!-- Toolbar de controles -->
      <div class="pdf-toolbar">
        <button type="button" class="pv-btn" (click)="prevPage()" [disabled]="currentPage <= 1"
                title="Página anterior">
          <i class="fa-solid fa-angle-left"></i>
        </button>

        <span class="pv-page-info">
          <input type="number" class="pv-page-input"
                 [(ngModel)]="pageInputValue"
                 (change)="goToPage(pageInputValue)"
                 [min]="1" [max]="totalPages" />
          <span class="text-muted">/ {{ totalPages || '–' }}</span>
        </span>

        <button type="button" class="pv-btn" (click)="nextPage()"
                [disabled]="currentPage >= totalPages"
                title="Página siguiente">
          <i class="fa-solid fa-angle-right"></i>
        </button>

        <span class="pv-divider"></span>

        <button type="button" class="pv-btn" (click)="zoomOut()" title="Alejar">
          <i class="fa-solid fa-magnifying-glass-minus"></i>
        </button>
        <span class="pv-zoom-label">{{ (scale * 100) | number:'1.0-0' }}%</span>
        <button type="button" class="pv-btn" (click)="zoomIn()" title="Acercar">
          <i class="fa-solid fa-magnifying-glass-plus"></i>
        </button>
        <button type="button" class="pv-btn" (click)="fitWidth()" title="Ajustar al ancho">
          <i class="fa-solid fa-arrows-left-right-to-line"></i>
        </button>

        <span class="pv-divider"></span>

        <button type="button" class="pv-btn" (click)="rotate()" title="Rotar 90°">
          <i class="fa-solid fa-rotate-right"></i>
        </button>

        <span class="pv-spacer"></span>

        <button type="button" class="pv-btn" (click)="download()" title="Descargar PDF">
          <i class="fa-solid fa-download"></i>
        </button>
        <button type="button" class="pv-btn" (click)="print()" title="Imprimir">
          <i class="fa-solid fa-print"></i>
        </button>
      </div>

      <!-- Estado de carga -->
      <div *ngIf="loading" class="pv-loading">
        <div class="spinner-border" role="status"></div>
        <span class="ms-2">Cargando PDF…</span>
      </div>

      <!-- Error -->
      <div *ngIf="errorMsg" class="pv-error">
        <i class="fa-solid fa-triangle-exclamation me-1"></i>
        {{ errorMsg }}
      </div>

      <!-- Contenedor de renderizado -->
      <div #viewport class="pv-viewport" [class.is-hidden]="loading || !!errorMsg">
        <canvas #canvas class="pv-canvas"></canvas>
      </div>
    </div>
  `,
  styles: [`
    /* El host de Angular debe expandirse al alto del contenedor padre.
       Si el padre tiene altura fija (p.ej. 420px en rendir-cuenta) el
       visor PDF la respetará; si no, usa min-height para no colapsar. */
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 350px;
    }

    .pdf-viewer-host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 350px;
      background: #f1f3f5;
      border-radius: 6px;
      overflow: hidden;
    }

    .pdf-toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: #2b3035;
      color: #fff;
      flex-wrap: wrap;
    }

    .pv-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #ffffff;
      width: 34px;
      height: 34px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, border-color 0.15s;
    }
    .pv-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }
    .pv-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .pv-page-info {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.9);
    }
    .pv-page-input {
      width: 48px;
      padding: 3px 6px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: rgba(0, 0, 0, 0.25);
      color: #fff;
      text-align: center;
      font-size: 0.85rem;
    }
    .pv-page-input::-webkit-inner-spin-button { display: none; }

    .pv-zoom-label {
      font-size: 0.8rem;
      min-width: 44px;
      text-align: center;
      color: rgba(255, 255, 255, 0.85);
    }

    .pv-divider {
      width: 1px;
      height: 22px;
      background: rgba(255, 255, 255, 0.2);
      margin: 0 4px;
    }

    .pv-spacer { flex: 1 1 auto; }

    .pv-viewport {
      flex: 1 1 auto;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 12px;
      background: #393f45;
      -webkit-overflow-scrolling: touch;
    }
    .pv-viewport.is-hidden { display: none; }

    .pv-canvas {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      max-width: none;
      background: #fff;
    }

    .pv-loading,
    .pv-error {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-size: 0.9rem;
      color: #495057;
      background: #f8f9fa;
    }
    .pv-error { color: #c0392b; }

    /* Toolbar más compacto en móvil */
    @media (max-width: 576px) {
      .pdf-toolbar { padding: 4px; gap: 3px; }
      .pv-btn { width: 30px; height: 30px; }
      .pv-divider { display: none; }
      .pv-zoom-label { display: none; }
      .pv-spacer { display: none; }
    }
  `],
})
export class PdfViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** URL, dataURL, BlobURL o ArrayBuffer del PDF. */
  @Input() src: string | ArrayBuffer | Uint8Array | null = null;

  /** Nombre sugerido para descarga. */
  @Input() filename: string = 'documento.pdf';

  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewport', { static: false }) viewportRef!: ElementRef<HTMLDivElement>;

  loading: boolean = true;
  errorMsg: string = '';

  currentPage: number = 1;
  totalPages: number = 0;
  pageInputValue: number = 1;

  scale: number = 1.0;
  rotation: number = 0;

  private pdfDoc: any = null;
  private renderTask: any = null;
  private static pdfjsPromise: Promise<any> | null = null;

  // ─── CDN PDF.js ───────────────────────────────────────────────────
  // URLs literales para evitar el problema de referencia circular en
  // propiedades static (PdfViewerComponent.X dentro de la misma clase).
  private static readonly PDFJS_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  private static readonly PDFJS_WORKER_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  ngAfterViewInit(): void {
    this.loadPdfIfReady();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] && !changes['src'].firstChange) {
      this.loadPdfIfReady();
    }
  }

  ngOnDestroy(): void {
    if (this.renderTask) {
      try { this.renderTask.cancel(); } catch { /* noop */ }
    }
    if (this.pdfDoc) {
      try { this.pdfDoc.destroy(); } catch { /* noop */ }
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.pdfDoc) {
      // Re-render para que respete el nuevo ancho disponible
      this.renderPage();
    }
  }

  // ────────────────────────────────────────────────────────────────────
  //  Carga del SDK PDF.js (una sola vez por sesión)
  // ────────────────────────────────────────────────────────────────────

  private cargarPdfJs(): Promise<any> {
    if ((window as any).pdfjsLib) {
      return Promise.resolve((window as any).pdfjsLib);
    }
    if (PdfViewerComponent.pdfjsPromise) {
      return PdfViewerComponent.pdfjsPromise;
    }
    PdfViewerComponent.pdfjsPromise = new Promise<any>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PdfViewerComponent.PDFJS_URL;
      script.async = true;
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (!lib) {
          reject(new Error('PDF.js no expuso pdfjsLib tras cargar el script'));
          return;
        }
        lib.GlobalWorkerOptions.workerSrc = PdfViewerComponent.PDFJS_WORKER_URL;
        resolve(lib);
      };
      script.onerror = () => reject(new Error('No se pudo descargar PDF.js desde CDN'));
      document.head.appendChild(script);
    });
    return PdfViewerComponent.pdfjsPromise;
  }

  // ────────────────────────────────────────────────────────────────────
  //  Carga y render del PDF
  // ────────────────────────────────────────────────────────────────────

  private async loadPdfIfReady(): Promise<void> {
    if (!this.src) {
      this.loading = false;
      this.errorMsg = '';
      return;
    }
    this.loading = true;
    this.errorMsg = '';

    try {
      const pdfjsLib = await this.cargarPdfJs();
      const docSource = this.buildDocSource(this.src);
      const loadingTask = pdfjsLib.getDocument(docSource);
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;
      this.pageInputValue = 1;
      this.loading = false;
      await this.fitWidthSilent();
      await this.renderPage();
    } catch (e: any) {
      this.loading = false;
      this.errorMsg = 'No se pudo cargar el PDF: ' + (e?.message || e);
      console.error('[pdf-viewer] error cargando PDF', e);
    }
  }

  /**
   * Construye el parámetro esperado por pdfjsLib.getDocument según el tipo
   * de `src`. Para data URLs hay que decodificar base64 a Uint8Array porque
   * PDF.js soporta URL directa pero data:base64 es más estable como bytes.
   */
  private buildDocSource(src: string | ArrayBuffer | Uint8Array): any {
    if (typeof src === 'string') {
      if (src.startsWith('data:')) {
        const comma = src.indexOf(',');
        const base64 = src.substring(comma + 1);
        const bytes = this.base64ToUint8Array(base64);
        return { data: bytes };
      }
      return { url: src, withCredentials: false };
    }
    if (src instanceof ArrayBuffer) {
      return { data: new Uint8Array(src) };
    }
    return { data: src };
  }

  private base64ToUint8Array(b64: string): Uint8Array {
    const raw = atob(b64.replace(/\s/g, ''));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      out[i] = raw.charCodeAt(i);
    }
    return out;
  }

  private async renderPage(): Promise<void> {
    if (!this.pdfDoc || !this.canvasRef) return;

    if (this.renderTask) {
      try { this.renderTask.cancel(); } catch { /* noop */ }
      this.renderTask = null;
    }

    const page = await this.pdfDoc.getPage(this.currentPage);
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;

    const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    this.renderTask = page.render({ canvasContext: context, viewport });
    try {
      await this.renderTask.promise;
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.warn('[pdf-viewer] render warning', e);
      }
    }
    this.pageInputValue = this.currentPage;
  }

  // ────────────────────────────────────────────────────────────────────
  //  Controles públicos
  // ────────────────────────────────────────────────────────────────────

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderPage();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.renderPage();
    }
  }

  goToPage(n: number): void {
    if (!n || n < 1 || n > this.totalPages) {
      this.pageInputValue = this.currentPage;
      return;
    }
    this.currentPage = Math.floor(n);
    this.renderPage();
  }

  zoomIn(): void {
    this.scale = Math.min(this.scale + 0.2, 3.0);
    this.renderPage();
  }

  zoomOut(): void {
    this.scale = Math.max(this.scale - 0.2, 0.4);
    this.renderPage();
  }

  fitWidth(): void {
    this.fitWidthSilent().then(() => this.renderPage());
  }

  /** Calcula la escala que hace que la página ocupe todo el ancho disponible. */
  private async fitWidthSilent(): Promise<void> {
    if (!this.pdfDoc || !this.viewportRef) return;
    const page = await this.pdfDoc.getPage(this.currentPage);
    const naturalViewport = page.getViewport({ scale: 1, rotation: this.rotation });
    const availableWidth = this.viewportRef.nativeElement.clientWidth - 24; // padding
    const ratio = availableWidth / naturalViewport.width;
    this.scale = Math.max(0.4, Math.min(ratio, 3.0));
  }

  rotate(): void {
    this.rotation = (this.rotation + 90) % 360;
    this.renderPage();
  }

  download(): void {
    if (typeof this.src === 'string') {
      const a = document.createElement('a');
      a.href = this.src;
      a.download = this.filename || 'documento.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  print(): void {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>${this.filename || 'PDF'}</title></head>
      <body style="margin:0">
        <iframe src="${this.src}" style="width:100%;height:100vh;border:0"
                onload="setTimeout(()=>{this.contentWindow.print();},400)"></iframe>
      </body></html>`);
    w.document.close();
  }
}
