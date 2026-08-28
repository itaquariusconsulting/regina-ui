import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import Swal from 'sweetalert2';

import { OpRendidaService } from '../../../services/op-rendida.service';
import { ObservacionService } from '../../../services/observacion.service';
import { FiltroOpRendida, OpRendida } from '../../../models/op-rendida';
import { RendicionDetDTO } from '../../../models/rendicion';
import { Motivo } from '../../../models/reporte-rendicion';

/**
 * Órdenes de pago rendidas, para que contabilidad continúe con la
 * liquidación.
 *
 * Lo que llega acá es lo que el usuario aprobó explícitamente desde REGINA.
 * Esa aprobación es el único momento en que alguien dice "esta rendición está
 * completa"; el estado del ERP no sirve para saberlo, porque sigue en 'PE'
 * hasta que contabilidad liquida.
 *
 * Consecuencia deliberada: las rendiciones anteriores a la antesala no
 * aparecen. Para esas nunca existió ese momento, así que mostrarlas sería
 * afirmar algo que no se sabe.
 */
@Component({
  selector: 'app-list-op-rendidas',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './list-op-rendidas.component.html',
  styleUrls: ['./list-op-rendidas.component.scss']
})
export class ListOpRendidasComponent implements OnInit {

  isLoading$: Observable<boolean>;

  codEmpresa: string = sessionStorage.getItem('codempresa') ?? '';
  codSucursal: string = '001';

  filtro: FiltroOpRendida = new FiltroOpRendida();

  rendidas: OpRendida[] = [];
  pagina: OpRendida[] = [];
  buscoAlgunaVez: boolean = false;

  paginaActual = 0;
  tamanioPagina = 10;
  totalPaginas = 0;

  readonly meses = [
    { valor: '', etiqueta: 'Todos' },
    { valor: '01', etiqueta: 'Enero' },
    { valor: '02', etiqueta: 'Febrero' },
    { valor: '03', etiqueta: 'Marzo' },
    { valor: '04', etiqueta: 'Abril' },
    { valor: '05', etiqueta: 'Mayo' },
    { valor: '06', etiqueta: 'Junio' },
    { valor: '07', etiqueta: 'Julio' },
    { valor: '08', etiqueta: 'Agosto' },
    { valor: '09', etiqueta: 'Setiembre' },
    { valor: '10', etiqueta: 'Octubre' },
    { valor: '11', etiqueta: 'Noviembre' },
    { valor: '12', etiqueta: 'Diciembre' },
  ];

  /** Años ofrecidos: el actual y los cuatro anteriores. */
  readonly anios: string[] = (() => {
    const actual = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(actual - i));
  })();

  // --- panel de revisión de una rendición
  opEnRevision?: OpRendida;
  comprobantes: RendicionDetDTO[] = [];
  motivos: Motivo[] = [];
  guardando = false;

  constructor(
    private location: Location,
    private loadingService: LoadingService,
    private opRendidaService: OpRendidaService,
    private observacionService: ObservacionService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    // Arranca con el periodo en el que está trabajando el usuario, que es lo
    // que casi siempre quiere ver. Si no hay, se muestra todo.
    this.filtro.anio = sessionStorage.getItem('periodo_year') ?? '';
    this.filtro.mes = sessionStorage.getItem('periodo_month') ?? '';

    this.observacionService.catalogoEstados().subscribe({
      next: (c) => this.estadosCatalogo = c ?? [],
      error: (e) => console.error('[op-rendidas] no se pudo cargar el catálogo de estados:', e)
    });

    this.buscar();
  }

  buscar(): void {
    this.loadingService.show();

    this.opRendidaService.buscar(this.codEmpresa, this.codSucursal, this.filtro).subscribe({
      next: (rendidas: OpRendida[]) => {
        this.loadingService.hide();
        this.rendidas = rendidas ?? [];
        this.buscoAlgunaVez = true;
        this.paginaActual = 0;
        this.paginar();
      },
      error: (err) => {
        this.loadingService.hide();
        this.buscoAlgunaVez = true;
        this.rendidas = [];
        this.paginar();
        console.error('[op-rendidas] no se pudo obtener la lista:', err);
      }
    });
  }

  limpiar(): void {
    this.filtro = new FiltroOpRendida();
    this.buscar();
  }

  // ------------------------------------------------- proceso contable

  /**
   * Los cinco estados del recorrido y qué significa cada uno.
   *
   * Se piden al backend en vez de escribirlos acá: la regla que los deduce
   * vive allá, y dos copias del mismo texto se desincronizan en la primera
   * corrección que alguien haga de un lado solo.
   */
  estadosCatalogo: { estado: string; etiqueta: string; explicacion: string }[] = [];

  etiquetaProceso(estado?: string): string {
    const encontrado = this.estadosCatalogo.find(e => e.estado === estado);
    if (encontrado) { return encontrado.etiqueta; }

    switch (estado) {
      case 'PENDIENTE':    return 'Pendiente';
      case 'EN_PROCESO':   return 'En proceso';
      case 'RECEPCIONADO': return 'Recepcionado';
      case 'OBSERVADO':    return 'Observado';
      case 'LIQUIDADO':    return 'Liquidado';
      default:             return 'Pendiente';
    }
  }

  explicacionProceso(estado?: string): string {
    return this.estadosCatalogo.find(e => e.estado === estado)?.explicacion ?? '';
  }

  claseProceso(estado?: string): string {
    switch (estado) {
      case 'EN_PROCESO':   return 'proc-proceso';
      case 'RECEPCIONADO': return 'proc-recep';
      case 'OBSERVADO':    return 'proc-obs';
      case 'LIQUIDADO':    return 'proc-liq';
      default:             return 'proc-sin';
    }
  }

  /** Solo se puede recepcionar lo que ya se envió y todavía no llegó. */
  puedeRecepcionar(op: OpRendida): boolean {
    return op.estProceso === 'EN_PROCESO';
  }

  yaRecepcionada(op: OpRendida): boolean {
    return !!op.fecRecepcion;
  }

  /**
   * El check: contabilidad confirma que llegaron los comprobantes físicos.
   *
   * Es lo único que se marca a mano en todo el recorrido. Al confirmarlo se
   * le avisa por correo a quien rindió — el envío lo hizo esa persona y ya lo
   * sabe, pero si los papeles llegaron no tiene forma de enterarse.
   */
  recepcionar(op: OpRendida): void {
    if (!this.puedeRecepcionar(op) || this.guardando) { return; }

    Swal.fire({
      title: `Marcar recepción de la OP ${op.numOrden}`,
      html: `<div style="text-align:left;font-size:0.88rem;color:#555;">
               Confirmás que llegaron los comprobantes físicos de
               <b>${op.desAuxiliar || op.codAuxiliar}</b>.
               Se le avisa por correo.
             </div>`,
      input: 'textarea',
      inputPlaceholder: 'Nota opcional para el correo',
      showCancelButton: true,
      confirmButtonText: 'Confirmar recepción',
      cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (!r.isConfirmed) { return; }
      this.enviarRecepcion(op, { nota: (r.value ?? '').toString().trim() });
    });
  }

  /** Deshace una recepción marcada por error, si todavía no se liquidó. */
  deshacerRecepcion(op: OpRendida): void {
    if (this.guardando) { return; }

    Swal.fire({
      icon: 'question',
      title: '¿Deshacer la recepción?',
      text: `La OP ${op.numOrden} vuelve a quedar en proceso.`,
      showCancelButton: true,
      confirmButtonText: 'Deshacer',
      cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (!r.isConfirmed) { return; }
      this.enviarRecepcion(op, { deshacer: true });
    });
  }

  private enviarRecepcion(op: OpRendida, cuerpo: { nota?: string; deshacer?: boolean }): void {
    this.guardando = true;

    this.observacionService.marcarRecepcion({
      codEmpresa: this.codEmpresa,
      codSucursal: this.codSucursal,
      numOrden: op.numOrden ?? '',
      userId: this.usuarioActual(),
      ...cuerpo,
    }).subscribe({
      next: (estado: any) => {
        this.guardando = false;
        // La fila se actualiza con lo que devolvió el servidor y no con lo
        // que supone la pantalla: el estado lo decide el backend a partir de
        // las fechas, y adivinarlo acá sería tener dos reglas.
        op.estProceso = estado?.estado ?? op.estProceso;
        op.fecRecepcion = estado?.fecRecepcion;
        op.observados = estado?.observados ?? op.observados;

        Swal.fire({
          toast: true, position: 'top-end', icon: 'success',
          title: cuerpo.deshacer ? 'Recepción deshecha' : 'Recepción registrada',
          showConfirmButton: false, timer: 2500, timerProgressBar: true,
        });
      },
      error: (err) => {
        this.guardando = false;
        console.error('[op-rendidas] no se pudo marcar la recepción:', err);
        Swal.fire({
          icon: err?.status === 409 ? 'warning' : 'error',
          title: 'No se pudo registrar',
          text: err?.error?.mensaje ?? 'Intentá de nuevo en unos minutos.',
          confirmButtonText: 'Entendido',
        });
      }
    });
  }

  /** La leyenda con los cinco estados. */
  verLeyenda(): void {
    const filas = this.estadosCatalogo.length
      ? this.estadosCatalogo
      : ['PENDIENTE', 'EN_PROCESO', 'RECEPCIONADO', 'OBSERVADO', 'LIQUIDADO']
          .map(e => ({ estado: e, etiqueta: this.etiquetaProceso(e), explicacion: '' }));

    const html = filas.map(f => `
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
        <span style="flex-shrink:0;padding:2px 9px;border-radius:999px;font-size:0.72rem;
                     font-weight:700;background:#f1f5f9;color:#334155;">${f.etiqueta}</span>
        <span style="font-size:0.83rem;color:#555;">${f.explicacion}</span>
      </div>`).join('');

    Swal.fire({
      title: 'Los estados de una rendición',
      html: `<div style="text-align:left;">${html}
             <div style="border-top:1px solid #dee2e6;margin-top:10px;padding-top:8px;
                         font-size:0.79rem;color:#777;">
               Solo <b>Recepcionado</b> se marca a mano. Los demás los deduce REGINA
               de las fechas: cuándo se creó, cuándo se envió y cuándo el ERP la
               dio por liquidada.
             </div></div>`,
      width: 560,
      confirmButtonText: 'Entendido',
    });
  }

  // ------------------------------------------------------------ revisión

  /**
   * Abre la revisión de una rendición: sus comprobantes, para marcar los que
   * no cuadran con el físico.
   *
   * Es lo que contabilidad ya hacía —sacar el comprobante del registro y
   * avisar por teléfono— pero anotado. Sin esto nadie puede decir cuántas
   * rendiciones vienen con problemas ni por qué, que es lo que se pidió
   * medir.
   */
  revisar(op: OpRendida): void {
    this.opEnRevision = op;
    this.comprobantes = [];
    this.loadingService.show();

    this.observacionService.rendicion(this.codEmpresa, this.codSucursal, op.numOrden ?? '')
      .subscribe({
        next: (cab) => {
          this.comprobantes = cab?.detalle ?? [];
          this.loadingService.hide();
        },
        error: (err) => {
          this.loadingService.hide();
          console.error('[op-rendidas] no se pudo abrir la rendición:', err);
          this.cerrarRevision();
          Swal.fire({
            icon: 'error',
            title: 'No se pudo abrir la rendición',
            text: 'Intentá de nuevo en unos minutos.',
            confirmButtonText: 'Entendido',
          });
        }
      });

    if (!this.motivos.length) {
      this.observacionService.motivos('COMPROBANTE').subscribe({
        next: (m) => this.motivos = m ?? [],
        error: (err) => console.error('[op-rendidas] no se pudieron cargar los motivos:', err)
      });
    }
  }

  cerrarRevision(): void {
    this.opEnRevision = undefined;
    this.comprobantes = [];
  }

  estaObservado(c: RendicionDetDTO): boolean {
    return c.indObservado === 'S';
  }

  descripcion(c: RendicionDetDTO): string {
    const serie = (c.numSerieDoc ?? '').trim();
    const numero = (c.numDocumento ?? '').trim();
    return serie || numero ? `${serie}-${numero}` : `Comprobante ${c.idRendDet}`;
  }

  /**
   * Pide el motivo y observa el comprobante.
   *
   * El motivo sale de un catálogo y no de un campo libre porque el reporte de
   * "principales motivos" sobre texto libre devuelve tantas filas como
   * observaciones haya: cada persona escribe distinto y no se agrupa nada.
   */
  observar(c: RendicionDetDTO): void {
    if (!c.idRendDet || this.guardando) { return; }

    const opciones: Record<string, string> = {};
    for (const m of this.motivos) { opciones[m.codMotivo] = m.desMotivo; }

    Swal.fire({
      title: `Observar ${this.descripcion(c)}`,
      html: `<div style="text-align:left;font-size:0.88rem;color:#555;">
               El comprobante queda marcado como que no sustenta. El asiento
               en contabilidad no se toca.
             </div>`,
      input: 'select',
      inputOptions: opciones,
      inputPlaceholder: 'Elegí el motivo',
      showCancelButton: true,
      confirmButtonText: 'Siguiente',
      cancelButtonText: 'Cancelar',
      inputValidator: (valor) => valor ? null : 'Hay que elegir un motivo.',
    }).then((paso1) => {
      if (!paso1.isConfirmed || !paso1.value) { return; }
      const codMotivo = String(paso1.value);
      const exigeDetalle = codMotivo === 'OTRO';

      Swal.fire({
        title: 'Detalle',
        input: 'textarea',
        inputPlaceholder: exigeDetalle
          ? 'Explicá de qué se trata (obligatorio)'
          : 'Opcional: lo que el usuario necesita saber para corregir',
        showCancelButton: true,
        confirmButtonText: 'Observar',
        cancelButtonText: 'Cancelar',
        inputValidator: (valor) => (exigeDetalle && (!valor || valor.trim().length < 5))
          ? 'Con el motivo "Otro" hay que escribir de qué se trata.'
          : null,
      }).then((paso2) => {
        if (!paso2.isConfirmed) { return; }
        this.enviarObservacion(c, { codMotivo, motivo: (paso2.value ?? '').trim() });
      });
    });
  }

  levantar(c: RendicionDetDTO): void {
    if (!c.idRendDet || this.guardando) { return; }
    this.enviarObservacion(c, { levantar: true });
  }

  private enviarObservacion(c: RendicionDetDTO, cuerpo: {
    codMotivo?: string; motivo?: string; levantar?: boolean;
  }): void {
    this.guardando = true;

    this.observacionService.observarComprobante(c.idRendDet!, {
      ...cuerpo,
      userId: this.usuarioActual(),
    }).subscribe({
      next: () => {
        this.guardando = false;
        // Se refleja en la lista sin recargar: contabilidad revisa varios
        // comprobantes seguidos y volver al servidor por cada uno la haría
        // esperar sin motivo.
        c.indObservado = cuerpo.levantar ? 'N' : 'S';
        c.codMotivoObs = cuerpo.levantar ? undefined : cuerpo.codMotivo;
        c.motivoObs = cuerpo.levantar ? undefined : cuerpo.motivo;

        Swal.fire({
          toast: true, position: 'top-end', icon: 'success',
          title: cuerpo.levantar ? 'Observación levantada' : 'Comprobante observado',
          showConfirmButton: false, timer: 2500, timerProgressBar: true,
        });
      },
      error: (err) => {
        this.guardando = false;
        console.error('[op-rendidas] no se pudo observar:', err);
        Swal.fire({
          icon: 'error',
          title: 'No se pudo registrar',
          text: err?.error?.mensaje ?? 'Intentá de nuevo en unos minutos.',
          confirmButtonText: 'Entendido',
        });
      }
    });
  }

  private usuarioActual(): number | undefined {
    try {
      const guardado = sessionStorage.getItem('user');
      if (!guardado) { return undefined; }
      const userId = JSON.parse(guardado)?.userId;
      return typeof userId === 'number' ? userId : undefined;
    } catch {
      return undefined;
    }
  }

  /** Cuántos comprobantes de la rendición abierta están observados. */
  get observadosEnRevision(): number {
    return this.comprobantes.filter(c => c.indObservado === 'S').length;
  }

  onBack(): void {
    this.location.back();
  }

  // ------------------------------------------------------------ paginación

  private paginar(): void {
    this.totalPaginas = Math.ceil(this.rendidas.length / this.tamanioPagina);
    const desde = this.paginaActual * this.tamanioPagina;
    this.pagina = this.rendidas.slice(desde, desde + this.tamanioPagina);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.totalPaginas) {
      return;
    }
    this.paginaActual = pagina;
    this.paginar();
  }

  // ------------------------------------------------------------ presentación

  /** Lo rendido, en la moneda de la orden. */
  importeRendido(op: OpRendida): number {
    return (op.codMoneda === '01' ? op.impRendidoSoles : op.impRendidoDolares) ?? 0;
  }

  /**
   * La diferencia entre lo entregado y lo rendido.
   *
   * Es el número que contabilidad mira primero: positivo significa que sobró
   * dinero por devolver, negativo que el usuario gastó de más.
   */
  diferencia(op: OpRendida): number {
    return (op.impOrdPago ?? 0) - this.importeRendido(op);
  }

  estaLiquidada(op: OpRendida): boolean {
    return op.tipEstado === 'LQ';
  }

  /** Las que todavía esperan a contabilidad. */
  get pendientesDeLiquidar(): number {
    return this.rendidas.filter(op => !this.estaLiquidada(op)).length;
  }

  mesEtiqueta(codPeriodo?: string): string {
    return this.meses.find(m => m.valor === codPeriodo)?.etiqueta ?? (codPeriodo ?? '');
  }
}
