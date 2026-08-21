import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { OrdenPago } from '../../../models/orden-pago';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { Observable } from 'rxjs';
import { Response } from '../../../models/response';
import { OrdenPagoDetDTO } from '../../../models/orden-pago-det';
import { OrdenPagoDetService } from '../../../services/orden-pago-det.service';
import { WrapperRequestOrdenPagoDet } from '../../../models/wrappers/wrapper-request-orden-pago-det';
import { MaeAuxiliarDTO } from '../../../models/mae-auxiliar-dto';
import { MaestrosService } from '../../../services/maestros.service';
import { MaeDocumento } from '../../../models/mae-documento';
import * as bootstrap from 'bootstrap';
import { DocumentoService } from '../../../services/documento.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PdfViewerComponent } from '../../../components/pdf-viewer/pdf-viewer.component';
import { RendicionService } from '../../../services/rendicion.service';
import {
  EliminarComprobanteRequest,
  EstadoRendicion,
  PreCerrarRequest,
  PublicacionResultadoDTO,
  RendicionCabDTO,
  RendicionDetDTO
} from '../../../models/rendicion';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-edit-orden-pago',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LoadingDancingSquaresComponent,
    HasPermissionDirective,
    PdfViewerComponent
  ],
  templateUrl: './list-orden-pago-det.component.html',
  styleUrls: ['./list-orden-pago-det.component.scss']
})
export class ListOrdenPagoDetComponent implements OnInit {
  constructor(
    private location: Location,
    private ordenPagoDetService: OrdenPagoDetService,
    private loadingService: LoadingService,
    private maestrosService: MaestrosService,
    private documentoService: DocumentoService,
    private rendicionService: RendicionService,
    private sanitizer: DomSanitizer
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  detail: RendicionDetDTO = new RendicionDetDTO();
  modal: any;

  codEmpresa: string = sessionStorage.getItem("codempresa") ?? '';
  isLoading$: Observable<boolean>;
  filtrarDetalle: string = "";
  orden: OrdenPago = new OrdenPago();
  pageSize = 8;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;
  detalles: RendicionDetDTO[] = [];
  ordenesGeneral: RendicionDetDTO[] = [];
  pagedDetalles: RendicionDetDTO[] = [];

  /**
   * La rendicion en REGINA.
   *
   * Es lo que decide todo lo demas en esta pantalla:
   *
   *   ABIERTA  los comprobantes salen de REGINA. Se pueden eliminar, y esta
   *            el boton de enviar a contabilidad.
   *   RENDIDA  los comprobantes ya estan en contabilidad. Solo lectura.
   *
   * Una rendicion vieja —de antes de que existiera la antesala— no tiene
   * nada en REGINA: en ese caso se listan los comprobantes del ERP y la
   * pantalla queda como estaba, en solo lectura.
   */
  rendicion: RendicionCabDTO = new RendicionCabDTO();
  /** True cuando los comprobantes salen de REGINA y no del ERP. */
  desdeAntesala: boolean = false;
  listaAuxiliares: MaeAuxiliarDTO[] = [];
  listaTiposDocumento: MaeDocumento[] = [];
  expandedRow: any = null;
  imagenDocumento: string | null = null;
  pdfDocumentoUrl: SafeResourceUrl | null = null;
  /**
   * URL cruda (blob:) del PDF en preview. La necesita `<app-pdf-viewer>`
   * que NO acepta SafeResourceUrl (sanitizado para iframes) — trabaja
   * directamente con el binario o la URL plana.
   *
   * Cuando el documento es un PDF, se setea junto a `pdfDocumentoUrl`
   * para que el visor PDF.js pueda renderizarlo.
   */
  pdfDocumentoRawUrl: string | null = null;
  private pdfObjectUrl: string | null = null;
  
  ngOnInit(): void {
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data;
    }
    this.getListaAuxiliaresPR();
  }

  onBack(): void {
    this.location.back();
  }

  toggleRow(row: any) {
    if (this.expandedRow === row) {
      this.expandedRow = null;
    } else {
      this.expandedRow = row;
    }
  }

  filtrar() {

  }

  private buildPagination(): void {
    this.totalItems = this.detalles.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    this.pagedDetalles = this.detalles.slice(start, end);
  }

  changePage(page: number): void {

    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.buildPagination();
  }

  /**
   * Trae los comprobantes de la rendicion.
   *
   * Primero pregunta a REGINA. Si la rendicion tiene comprobantes ahi, esos
   * son los que valen: es la antesala, todavia no llegaron a contabilidad.
   * Si REGINA no tiene nada —una rendicion vieja, de antes de que existiera
   * este paso— se listan los del ERP y la pantalla queda en solo lectura,
   * igual que antes.
   *
   * Si REGINA no responde, tambien se cae al ERP. Que se caiga un servicio no
   * puede dejar al usuario sin ver su rendicion.
   */
  getOrdenPagoDet() {
    this.rendicionService
      .obtener(this.orden.codEmpresa ?? '', this.orden.codSucursal ?? '', this.orden.numOrden ?? '')
      .subscribe({
        next: (cab: RendicionCabDTO) => {
          this.rendicion = cab ?? new RendicionCabDTO();
          const enAntesala = this.rendicion.detalle ?? [];

          if (enAntesala.length > 0) {
            this.desdeAntesala = true;
            this.loadingService.hide();
            this.detalles = enAntesala;
            this.currentPage = 0;
            this.buildPagination();
            return;
          }

          this.desdeAntesala = false;
          this.getOrdenPagoDetDelErp();
        },
        error: (err) => {
          console.error('[rendicion] no se pudo consultar la antesala:', err);
          this.desdeAntesala = false;
          this.getOrdenPagoDetDelErp();
        }
      });
  }

  /** Los comprobantes tal como quedaron en contabilidad. */
  private getOrdenPagoDetDelErp() {
    var wrapper: WrapperRequestOrdenPagoDet = new WrapperRequestOrdenPagoDet();
    wrapper.codEmpresa = this.orden.codEmpresa;
    wrapper.codSucursal = this.orden.codSucursal;
    wrapper.numOrden = this.orden.numOrden;
    this.ordenPagoDetService.getOrdenesPagoDet(wrapper).subscribe(
      (response: Response) => {
        this.loadingService.hide();
        this.detalles = (response.resultado ?? []).map(
          (d: OrdenPagoDetDTO) => Object.assign(new RendicionDetDTO(), d));
        this.currentPage = 0;
        this.buildPagination();
      },
      (error) => {
        this.loadingService.hide();
      }
    )
  }

  // ------------------------------------------------------------ estado

  /**
   * Si el usuario todavia puede tocar la rendicion.
   *
   * Hacen falta las dos cosas: que este abierta y que los comprobantes
   * vengan de REGINA. Los del ERP no se editan desde aca ni aunque la
   * cabecera diga ABIERTA.
   */
  get puedeEditar(): boolean {
    return this.desdeAntesala && this.rendicion.estado !== 'RENDIDA';
  }

  /** Si ya se puede mandar a contabilidad. */
  get puedePreCerrar(): boolean {
    return this.puedeEditar && this.detalles.length > 0;
  }

  get estadoRendicion(): EstadoRendicion {
    return this.rendicion.estado === 'RENDIDA' ? 'RENDIDA' : 'ABIERTA';
  }

  /** Texto del estado para mostrar arriba de la grilla. */
  get textoEstado(): string {
    if (!this.desdeAntesala) {
      return 'En contabilidad';
    }
    return this.estadoRendicion === 'RENDIDA'
      ? 'Rendida'
      : 'En preparación';
  }

  // ------------------------------------------------------------ eliminar

  /**
   * Saca de la rendicion un comprobante que se subio por error.
   *
   * Se pide el motivo, y no por burocracia: el comprobante se borra de
   * verdad, y cuando despues alguien pregunte por que ese gasto no llego a
   * contabilidad, el motivo es la unica respuesta que va a existir.
   */
  async eliminarComprobante(reg: RendicionDetDTO, event?: Event) {
    event?.stopPropagation();

    if (!this.puedeEditar || !reg.idRendDet) {
      return;
    }

    const documento = `${reg.numSerieDoc ?? ''}-${reg.numDocumento ?? ''}`;

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar este comprobante?',
      html: `<div style="text-align:left;font-size:0.9rem;">
               <p>Se va a quitar <strong>${documento}</strong> de la rendición,
                  junto con el archivo escaneado.</p>
               <p class="text-muted" style="font-size:0.8rem;">
                  Todavía no llegó a contabilidad, así que se puede volver a
                  cargar cuando quiera.</p>
             </div>`,
      input: 'text',
      inputLabel: '¿Por qué lo elimina?',
      inputPlaceholder: 'Ej.: lo subí dos veces',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      inputValidator: (valor) => (valor && valor.trim() ? null : 'Escriba el motivo'),
    });

    if (!confirmacion.isConfirmed) {
      return;
    }

    const pedido = new EliminarComprobanteRequest();
    pedido.motivo = String(confirmacion.value ?? '').trim();
    pedido.borrarArchivo = true;
    pedido.userId = this.usuarioActual();

    this.loadingService.show();
    this.rendicionService.eliminar(reg.idRendDet, pedido).subscribe({
      next: (respuesta: Response) => {
        this.loadingService.hide();
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: respuesta?.mensaje || 'Comprobante eliminado.',
          showConfirmButton: false,
          timer: 2500,
        });
        this.getOrdenPagoDet();
      },
      error: (err) => {
        this.loadingService.hide();
        this.avisarError(err, 'No se pudo eliminar el comprobante');
      }
    });
  }

  // ------------------------------------------------------------ pre-cerrar

  /**
   * Manda la rendicion a contabilidad.
   *
   * Es el unico paso irreversible de esta pantalla, y por eso la
   * confirmacion es la que es: obliga a escribir CERRAR. Un boton de "si"
   * se aprieta sin leer; escribir una palabra, no. Despues de esto el
   * usuario no puede agregar, corregir ni eliminar nada, y la rendicion no
   * se reabre — si algo quedo mal, lo corrige contabilidad de su lado.
   */
  async preCerrar() {
    if (!this.puedePreCerrar) {
      return;
    }

    const cuantos = this.detalles.length;

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Enviar la rendición a contabilidad?',
      html: `<div style="text-align:left;font-size:0.9rem;">
               <p>Se van a enviar <strong>${cuantos} comprobante(s)</strong>.</p>
               <p><strong>Después de esto no se puede modificar ni reabrir.</strong>
                  Si algo queda mal, lo tiene que corregir contabilidad.</p>
               <p class="text-muted" style="font-size:0.8rem;">
                  Escriba <strong>CERRAR</strong> para confirmar.</p>
             </div>`,
      input: 'text',
      inputPlaceholder: 'CERRAR',
      showCancelButton: true,
      confirmButtonText: 'Enviar a contabilidad',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      inputValidator: (valor) =>
        String(valor ?? '').trim().toUpperCase() === 'CERRAR'
          ? null
          : 'Escriba CERRAR para confirmar',
    });

    if (!confirmacion.isConfirmed) {
      return;
    }

    const pedido = new PreCerrarRequest();
    pedido.codEmpresa = this.orden.codEmpresa;
    pedido.codSucursal = this.orden.codSucursal;
    pedido.numOrden = this.orden.numOrden;
    pedido.userId = this.usuarioActual();
    pedido.exigirValidacionSunat = false;

    this.loadingService.show();
    this.rendicionService.preCerrar(pedido).subscribe({
      next: (resultado: PublicacionResultadoDTO) => {
        this.loadingService.hide();
        this.mostrarResultadoDelCierre(resultado);
        this.getOrdenPagoDet();
      },
      error: (err) => {
        this.loadingService.hide();
        this.avisarError(err, 'No se pudo enviar la rendición a contabilidad');
      }
    });
  }

  /**
   * Cuenta como salio el envio.
   *
   * Las advertencias se muestran aunque haya salido bien: son cosas que no
   * impidieron publicar pero que alguien tiene que ver —un comprobante sin
   * validar en SUNAT, un archivo que no se pudo renombrar—. Esconderlas
   * detras de un "listo" es como no haberlas detectado.
   */
  private mostrarResultadoDelCierre(resultado: PublicacionResultadoDTO): void {
    const advertencias = resultado?.advertencias ?? [];

    if (advertencias.length === 0) {
      Swal.fire({
        icon: 'success',
        title: 'Rendición enviada',
        text: resultado?.mensaje || 'La rendición ya está en contabilidad.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const lista = advertencias
      .map(a => `<li>${this.escapar(a)}</li>`)
      .join('');

    Swal.fire({
      icon: 'success',
      title: 'Rendición enviada',
      html: `<div style="text-align:left;font-size:0.9rem;">
               <p>${this.escapar(resultado?.mensaje || '')}</p>
               <p class="mb-1"><strong>Para tener en cuenta:</strong></p>
               <ul style="font-size:0.85rem;">${lista}</ul>
             </div>`,
      width: 600,
      confirmButtonText: 'Entendido',
    });
  }

  // ------------------------------------------------------------ helpers

  /** El id del usuario de la sesion, o undefined si no se pudo leer. */
  private usuarioActual(): number | undefined {
    try {
      const guardado = sessionStorage.getItem('user');
      if (!guardado) {
        return undefined;
      }
      const userId = JSON.parse(guardado)?.userId;
      return typeof userId === 'number' ? userId : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Muestra el error.
   *
   * El backend responde 409 cuando la operacion no corresponde —la rendicion
   * ya se cerro, el comprobante ya no esta— y manda un mensaje escrito para
   * el usuario. Ese se muestra tal cual; reemplazarlo por uno generico seria
   * quitarle al usuario la unica explicacion util.
   */
  private avisarError(err: any, titulo: string): void {
    console.error(`[rendicion] ${titulo}:`, err);

    const mensaje = err?.error?.mensaje;

    Swal.fire({
      icon: err?.status === 409 ? 'warning' : 'error',
      title: titulo,
      text: mensaje || 'Intente nuevamente. Si el problema sigue, avise a soporte.',
      confirmButtonText: 'Entendido',
    });
  }

  private escapar(texto: string): string {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  getListaAuxiliaresPR() {
    this.loadingService.show();
    this.maestrosService.getListaAuxiliaresPR(this.codEmpresa).subscribe(
      (response: Response) => {
        this.listaAuxiliares = response.resultado;
        this.listaAuxiliares.sort((a, b) => (a.codAuxiliar ?? '').localeCompare(b.codAuxiliar ?? ''));
        this.getListaDocumentos();
      },
      (error) => {
        console.log("No hay Auxiliares");
        this.loadingService.hide();
      }
    )
  }

  getListaDocumentos() {
    this.maestrosService.getTiposDocumento(this.codEmpresa).subscribe(
      (response: Response) => {
        this.listaTiposDocumento = response.resultado;
        this.getOrdenPagoDet();
      }
    )
  }

  getTipoDocumento(tipoDocumento: string): MaeDocumento {
    const doc = this.listaTiposDocumento.find(doc => doc.codDocumento == tipoDocumento) ?? new MaeDocumento();
    return doc;
  }

  onDevuelveAuxiliar(codAuxiliar: string): MaeAuxiliarDTO {
    const aux: MaeAuxiliarDTO = this.listaAuxiliares.find(cod => cod.codAuxiliar?.trim() == codAuxiliar.trim()) ?? new MaeAuxiliarDTO();
    return aux;
  }

  abrirModalDoc(reg: RendicionDetDTO, event?: Event) {
    event?.stopPropagation();
    this.limpiarDocumentoPreview();
    this.detail = reg;

    const [tipo, anio, mes] = this.carpetaDelArchivo(reg);
    this.viewDocumento(tipo, anio, mes, this.nombreDelArchivo(reg));
  }

  /**
   * En que carpeta esta el archivo escaneado: [tipo, anio, mes].
   *
   * Los archivos se guardan en {tipoDocumento}/{anio}/{mes}, con el anio y el
   * mes del PERIODO de la orden. Hasta ahora esa ruta se rearmaba en cada
   * consulta a partir del periodo que tuviera la orden en ese momento, y eso
   * es fragil: si el periodo cambia, la ruta calculada deja de apuntar donde
   * el archivo realmente esta y el documento "desaparece".
   *
   * Ahora REGINA guarda la ruta con la que se subio (ARCHIVO_RUTA), asi que
   * esa manda. Rearmarla queda solo como respaldo para las rendiciones viejas,
   * que no tienen ese dato.
   */
  private carpetaDelArchivo(reg: RendicionDetDTO): [string, string, string] {
    const partes = (reg.archivoRuta ?? '').split('/').filter(p => p.trim());

    if (partes.length === 3) {
      return [partes[0], partes[1], partes[2]];
    }

    return [
      reg.codDocumento ?? '',
      this.orden.anoPeriodo ?? '',
      this.orden.codPeriodo ?? ''
    ];
  }

  /**
   * Con que nombre buscar el archivo escaneado.
   *
   * Contabilidad nombra los archivos por NUM_ITEM_OP, pero en la antesala ese
   * numero todavia no existe —lo asigna el ERP al publicar—, asi que ahi el
   * archivo se llama por el id de REGINA. Cuando REGINA sabe el nombre real,
   * ese manda; si no, se arma el de contabilidad como siempre.
   *
   * Se devuelve sin extension: el backend prueba las que conoce (pdf, jpg,
   * png, ...) hasta encontrar el archivo.
   */
  private nombreDelArchivo(reg: RendicionDetDTO): string {
    if (reg.archivoNombre) {
      const punto = reg.archivoNombre.lastIndexOf('.');
      return punto > 0 ? reg.archivoNombre.substring(0, punto) : reg.archivoNombre;
    }

    return (reg.codEmpresa ?? '0000') +
      reg.codSucursal +
      this.orden.numOrden +
      (reg.numItemOp ?? '');
  }

  /** Si el comprobante tiene un archivo escaneado que se pueda abrir. */
  tieneArchivo(reg: RendicionDetDTO): boolean {
    return !!reg.archivoNombre || !!reg.numItemOp;
  }

  cerrarModalDoc() {
    this.limpiarDocumentoPreview();
    if (this.modal) {
      this.modal.hide();
    }
  }

  viewDocumento(tipo: string, anio: string, mes: string, nombre: string) {
    this.documentoService
      .viewDocumento(tipo, anio, mes, nombre)
      .subscribe({

        next: async (blob) => {
          this.limpiarDocumentoPreview();

          if (await this.esPdf(blob)) {
            this.pdfObjectUrl = URL.createObjectURL(blob);
            this.pdfDocumentoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl);
            // ✅ También exponemos el blob URL plano para <app-pdf-viewer>
            // (PDF.js): el iframe nativo del navegador a veces no renderiza
            // PDFs descargados desde un backend con CSP estricto, mientras
            // que PDF.js trabaja directamente con los bytes.
            this.pdfDocumentoRawUrl = this.pdfObjectUrl;
            this.abrirModal();
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            this.imagenDocumento = reader.result as string;
            this.abrirModal();
          };
          reader.readAsDataURL(blob);
        },

        error: (err) => {

          console.log("Documento no encontrado");

          // aquí puedes mostrar un toast si quieres
          // this.toastService.warning("El documento no existe");

        }
      });
  }

  hasExpandableRows(): boolean {
    return this.pagedDetalles.some(det => det.codDocumento);
  }

  private abrirModal(): void {
    const modalElement = document.getElementById('modalDocumento');
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement);
      this.modal.show();
    }
  }

  private limpiarDocumentoPreview(): void {
    this.imagenDocumento = null;
    this.pdfDocumentoUrl = null;
    this.pdfDocumentoRawUrl = null;
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
  }

  private async esPdf(blob: Blob): Promise<boolean> {
    if (blob.type === 'application/pdf') {
      return true;
    }

    const header = await blob.slice(0, 4).text();
    return header === '%PDF';
  }
}
