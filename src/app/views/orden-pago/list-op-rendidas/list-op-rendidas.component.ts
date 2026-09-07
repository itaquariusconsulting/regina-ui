import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import Swal from 'sweetalert2';

import { OpRendidaService } from '../../../services/op-rendida.service';
import { ObservacionService } from '../../../services/observacion.service';
import { MatDialog } from '@angular/material/dialog';
import { ObservarComprobanteDialogComponent, ObservarDialogResult }
  from '../../../components/dialogs/observar-comprobante-dialog.component';
import { FiltroOpRendida, OpRendida } from '../../../models/op-rendida';
import { RendicionDetDTO } from '../../../models/rendicion';
import { Motivo } from '../../../models/reporte-rendicion';
import { OrdenPagoCabPlanilla } from '../../../models/orden-pago-planilla-movilidad-cab';
import { AbonoRendicion } from '../../../models/abono-rendicion';
import { OrdenPagoPlanillaMovilidadCabService }
  from '../../../services/orden-pago-planilla-movilidad-cab.service';
import { AbonoService } from '../../../services/abono.service';
import { PublicacionPlanillaService } from '../../../services/publicacion-planilla.service';
import { VisorDocumentoDialogComponent, VisorDocumentoData }
  from '../../../components/dialogs/visor-documento-dialog.component';

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

  // --- la fila desplegada, con todo lo que trae esa orden
  //
  // Una sola a la vez, y a proposito: con dos abiertas la tabla se vuelve
  // ilegible, y contabilidad revisa una orden y pasa a la siguiente.
  opEnRevision?: OpRendida;
  comprobantes: RendicionDetDTO[] = [];
  planillas: OrdenPagoCabPlanilla[] = [];
  devoluciones: AbonoRendicion[] = [];

  /** Spinner por seccion: cada una llega por su lado y no se esperan entre si. */
  cargandoComprobantes = false;
  cargandoPlanillas = false;
  cargandoDevoluciones = false;

  motivos: Motivo[] = [];
  guardando = false;

  constructor(
    private location: Location,
    private loadingService: LoadingService,
    private opRendidaService: OpRendidaService,
    private observacionService: ObservacionService,
    private planillaService: OrdenPagoPlanillaMovilidadCabService,
    private abonoService: AbonoService,
    private publicacionService: PublicacionPlanillaService,
    private dialog: MatDialog
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

    // Si el servidor tiene apagada la emision de asientos, el boton de
    // aprobar no se ofrece. Prometer algo que el backend va a rechazar es
    // peor que no mostrarlo.
    this.publicacionService.estado().subscribe({
      next: (r: any) => {
        this.envioHabilitado = !!r?.resultado?.activa;
        this.tipoGastoSugerido = r?.resultado?.tipoGasto || '';
      },
      error: () => { this.envioHabilitado = false; }
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
  /**
   * Despliega debajo de la orden todo lo que esa OP trae en REGINA.
   *
   * <p>Tres cosas distintas que hasta ahora se miraban en tres sitios: los
   * comprobantes, las planillas de movilidad y las devoluciones con su
   * voucher. Contabilidad las tiene que ver juntas porque juntas son lo que
   * sustenta la orden; separadas hay que sumar de cabeza para saber si cuadra.
   *
   * <p>Una sola fila abierta a la vez. Volver a tocar la misma la cierra.
   */
  alternarDetalle(op: OpRendida): void {
    if (this.opEnRevision?.numOrden === op.numOrden) {
      this.cerrarRevision();
      return;
    }
    this.abrirDetalle(op);
  }

  estaDesplegada(op: OpRendida): boolean {
    return this.opEnRevision?.numOrden === op.numOrden;
  }

  private abrirDetalle(op: OpRendida): void {
    this.opEnRevision = op;
    this.comprobantes = [];
    this.planillas = [];
    this.devoluciones = [];

    const numOrden = op.numOrden ?? '';

    // Las tres van en paralelo y cada una pinta cuando llega. No se usa el
    // loading global: bloquear la pantalla entera para desplegar una fila
    // deja a contabilidad esperando sin poder mirar el resto de la lista.
    this.cargarComprobantes(numOrden);
    this.cargarPlanillas(op);
    this.cargarDevoluciones(numOrden);

    if (!this.motivos.length) {
      this.observacionService.motivos('COMPROBANTE').subscribe({
        next: (m) => this.motivos = m ?? [],
        error: (err) => console.error('[op-rendidas] no se pudieron cargar los motivos:', err)
      });
    }
  }

  private cargarComprobantes(numOrden: string): void {
    this.cargandoComprobantes = true;

    this.observacionService.rendicion(this.codEmpresa, this.codSucursal, numOrden)
      .subscribe({
        next: (cab) => {
          this.comprobantes = cab?.detalle ?? [];
          this.cargandoComprobantes = false;
        },
        error: (err) => {
          this.cargandoComprobantes = false;
          console.error('[op-rendidas] no se pudieron leer los comprobantes:', err);
        }
      });
  }

  /**
   * Las planillas de movilidad de la orden.
   *
   * <p>Si falla no se cierra el despliegue ni se avisa con un modal: los
   * comprobantes son lo principal y una orden sin planillas es lo normal.
   * Un error acá deja la seccion vacia, que es lo mismo que ve quien no tiene
   * planillas, y el detalle queda en consola.
   */
  private cargarPlanillas(op: OpRendida): void {
    this.cargandoPlanillas = true;

    this.planillaService.getPlanillaMovilidad({
      codEmpresa: this.codEmpresa,
      codSucursal: this.codSucursal,
      anioPeriodo: op.anoPeriodo ?? '',
      codPeriodo: op.codPeriodo ?? '',
      numOrden: op.numOrden ?? ''
    }).subscribe({
      next: (r: any) => {
        this.planillas = (r?.resultado ?? []) as OrdenPagoCabPlanilla[];
        this.cargandoPlanillas = false;
      },
      error: (err) => {
        this.cargandoPlanillas = false;
        console.error('[op-rendidas] no se pudieron leer las planillas:', err);
      }
    });
  }

  private cargarDevoluciones(numOrden: string): void {
    this.cargandoDevoluciones = true;

    this.abonoService.listar(this.codEmpresa, this.codSucursal, numOrden).subscribe({
      next: (r) => {
        // Las anuladas no se muestran: siguen en la base como rastro, pero
        // no sustentan nada y en una pantalla de revision solo confunden.
        this.devoluciones = (r?.abonos ?? []).filter(a => a.indAnulado !== 'S');
        this.cargandoDevoluciones = false;
      },
      error: (err) => {
        this.cargandoDevoluciones = false;
        console.error('[op-rendidas] no se pudieron leer las devoluciones:', err);
      }
    });
  }

  // ------------------------------------------------------------ documentos

  /** Si el comprobante tiene un escaneo que se pueda abrir. */
  tieneEscaneo(c: RendicionDetDTO): boolean {
    return !!c.archivoNombre || !!c.numItemOp;
  }

  /**
   * Abre el escaneo de un comprobante.
   *
   * <p>La ruta guardada manda. Solo se rearma desde el periodo de la orden
   * para las rendiciones viejas, que se cargaron antes de que REGINA
   * guardara ARCHIVO_RUTA: ahi es lo unico que hay.
   */
  verComprobante(c: RendicionDetDTO): void {
    const op = this.opEnRevision;
    if (!op) { return; }

    const partes = (c.archivoRuta ?? '').split('/').filter(x => x.trim());

    const tipo = partes.length === 3 ? partes[0] : (c.codDocumento ?? '');
    const anio = partes.length === 3 ? partes[1] : (op.anoPeriodo ?? '');
    const mes  = partes.length === 3 ? partes[2] : (op.codPeriodo ?? '');

    this.abrirVisor({
      tipo, anio, mes,
      nombre: this.nombreSinExtension(c, op),
      titulo: this.descripcion(c),
      subtitulo: c.razonSocialEmisor || c.rucEmisor || undefined
    });
  }

  /** Si la devolucion tiene voucher adjunto. */
  tieneVoucher(a: AbonoRendicion): boolean {
    return (a.archivoRuta ?? '').split('/').filter(x => x.trim()).length === 3
        && !!a.archivoNombre;
  }

  /**
   * Abre el voucher del deposito.
   *
   * <p>Es el documento que decide si la devolucion se aprueba: sin ver el
   * numero de operacion y el importe contra lo que dice REGINA no hay nada
   * que verificar.
   */
  verVoucher(a: AbonoRendicion): void {
    const partes = (a.archivoRuta ?? '').split('/').filter(x => x.trim());

    if (partes.length !== 3 || !a.archivoNombre) {
      Swal.fire({
        icon: 'info',
        title: 'Sin voucher',
        text: 'Este depósito no tiene un archivo adjunto.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.abrirVisor({
      tipo: partes[0], anio: partes[1], mes: partes[2],
      nombre: this.sinExtension(a.archivoNombre),
      titulo: 'Voucher · Op. ' + (a.numOperacion || 's/n'),
      subtitulo: (a.desBanco || '') + ' · S/ ' + (a.impSoles ?? 0)
    });
  }

  private abrirVisor(data: VisorDocumentoData): void {
    this.dialog.open(VisorDocumentoDialogComponent, {
      width: '78rem',
      maxWidth: '95vw',
      panelClass: 'visor-documento-panel',
      autoFocus: false,
      data
    });
  }

  /**
   * Con que nombre buscar el escaneo del comprobante.
   *
   * <p>Contabilidad los nombra por NUM_ITEM_OP, pero en la antesala ese
   * numero todavia no existe y el archivo se llama por el id de REGINA.
   * Cuando REGINA sabe el nombre real, ese manda.
   */
  private nombreSinExtension(c: RendicionDetDTO, op: OpRendida): string {
    if (c.archivoNombre) {
      return this.sinExtension(c.archivoNombre);
    }
    return (c.codEmpresa ?? '0000')
      + (c.codSucursal ?? this.codSucursal)
      + (op.numOrden ?? '')
      + (c.numItemOp ?? '');
  }

  private sinExtension(nombre: string): string {
    const punto = nombre.lastIndexOf('.');
    return punto > 0 ? nombre.substring(0, punto) : nombre;
  }

  cerrarRevision(): void {
    this.opEnRevision = undefined;
    this.comprobantes = [];
    this.planillas = [];
    this.devoluciones = [];
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

    // Un solo modal en vez de dos SweetAlert encadenados: antes habia que
    // elegir el motivo sin ver todavia el campo del comentario, y volver
    // atras significaba cancelar los dos pasos.
    this.dialog.open(ObservarComprobanteDialogComponent, {
      width: '32rem',
      autoFocus: false,
      data: {
        descripcion: this.descripcion(c),
        motivos: this.motivos,
        minimoComentario: 5
      }
    }).afterClosed().subscribe((r: ObservarDialogResult | undefined) => {
      if (!r) { return; }
      this.enviarObservacion(c, { codMotivo: r.codMotivo, motivo: r.motivo });
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

  // --- emision del asiento de una planilla
  envioHabilitado = false;
  private tipoGastoSugerido = '';

  /** Una planilla cerrada que todavia no tiene su asiento en contabilidad. */
  esperaAprobacion(pl: OrdenPagoCabPlanilla): boolean {
    return pl.statusPlanilla === 'CE';
  }

  yaTieneAsiento(pl: OrdenPagoCabPlanilla): boolean {
    return pl.statusPlanilla === 'AP';
  }

  /**
   * Aprueba la planilla y emite su asiento.
   *
   * <p>La planilla ya vive en la base de contabilidad desde que se grabo:
   * lo que estaba esperando era el ASIENTO, no la planilla. Por eso este
   * boton no manda nada nuevo alla, sino que autoriza el item que descarga
   * la entrega a rendir.
   *
   * <p>No es reversible desde REGINA y por eso se pregunta. El servidor toma
   * la planilla con un candado antes de escribir, asi que un segundo intento
   * se rechaza en vez de duplicar el asiento; pero el boton igual se bloquea
   * mientras la llamada esta en curso, porque apoyarse solo en el candado
   * significa depender de que el error llegue bien.
   */
  aprobarPlanilla(pl: OrdenPagoCabPlanilla): void {
    if (!this.esperaAprobacion(pl) || this.guardando) { return; }

    Swal.fire({
      icon: 'question',
      title: `¿Aprobar la planilla ${pl.codPlanilla}?`,
      html: `<div style="text-align:left;font-size:0.88rem;color:#555;">
               Se emite el asiento en contabilidad por
               <b>S/ ${(pl.total ?? pl.monto ?? 0).toFixed(2)}</b>.
               No se puede deshacer desde REGINA.
             </div>`,
      showCancelButton: true,
      confirmButtonText: 'Aprobar y emitir',
      cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (!r.isConfirmed) { return; }
      this.emitirAsiento(pl);
    });
  }

  private emitirAsiento(pl: OrdenPagoCabPlanilla): void {
    this.guardando = true;

    this.publicacionService.publicar(pl, this.tipoGastoSugerido).subscribe({
      next: (r: any) => {
        this.guardando = false;
        // Se marca en la fila que ya esta en pantalla en vez de recargar
        // todo: contabilidad aprueba varias seguidas y volver al servidor
        // por cada una la haria esperar sin motivo.
        pl.statusPlanilla = 'AP';

        Swal.fire({
          toast: true, position: 'top-end', icon: 'success',
          title: r?.mensaje || 'Asiento emitido',
          showConfirmButton: false, timer: 4000, timerProgressBar: true,
        });
      },
      error: (err: any) => {
        this.guardando = false;
        console.error('[op-rendidas] no se pudo emitir el asiento:', err);
        Swal.fire({
          icon: err?.status === 409 ? 'warning' : 'error',
          title: 'No se emitió el asiento',
          text: err?.error?.mensaje
             ?? 'La planilla quedó como estaba. Intentá de nuevo en unos minutos.',
          confirmButtonText: 'Entendido',
        });
      }
    });
  }

  /**
   * Lo devuelto en la orden desplegada.
   *
   * Se suma acá y no se pide al backend porque la lista ya está en pantalla
   * y son cuatro depósitos como mucho. Las anuladas ya quedaron fuera al
   * cargar, así que este total es el que sustenta.
   */
  get totalDevuelto(): number {
    return this.devoluciones.reduce((suma, d) => suma + (d.impSoles ?? 0), 0);
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
