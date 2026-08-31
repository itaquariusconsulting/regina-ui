import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { ColumnaPdf, ReportePdf, TarjetaPdf, fecha as fmtFecha, nro } from '../../../shared/reporte-pdf';
import { ReporteRendicionService } from '../../../services/reporte-rendicion.service';
import { DatosGerenciales, ReportsService } from '../../../services/reports.service';
import {
  FiltroReporte,
  ObservacionesResumen,
  OpcionesFiltro,
  OpcionFiltro,
  RendicionPorCentroCosto,
  RendicionPorUsuario,
  ResumenRendiciones,
  TiempoComprobante,
  TiempoOrden,
  TiemposEtapa,
  UsoRegina
} from '../../../models/reporte-rendicion';

type Vista = 'resumen' | 'usuarios' | 'centros' | 'tiempos' | 'observaciones' | 'uso';

/**
 * Los tres reportes de rendición, en una sola pantalla con pestañas.
 *
 * Son tres preguntas sobre lo mismo —cuánto llegó, quién lo mandó, cuánto
 * tardó— y comparten los mismos filtros. Separarlas en tres pantallas
 * obligaría a repetir el rango de fechas tres veces para comparar.
 *
 * <p>Todo es de solo lectura. Nada de esta pantalla escribe.
 */
@Component({
  selector: 'app-reportes-rendicion',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './reportes-rendicion.component.html',
  styleUrls: ['./reportes-rendicion.component.scss']
})
export class ReportesRendicionComponent implements OnInit {

  isLoading$: Observable<boolean>;

  codEmpresa: string = sessionStorage.getItem('codempresa') ?? '';
  codSucursal: string = '001';

  vista: Vista = 'resumen';
  filtro: FiltroReporte = new FiltroReporte();

  resumen?: ResumenRendiciones;
  usuarios: RendicionPorUsuario[] = [];
  centros: RendicionPorCentroCosto[] = [];
  tiempos: TiempoComprobante[] = [];
  /** El recorrido por OP: lo que pidió contabilidad para esta pestaña. */
  tiemposOrden: TiempoOrden[] = [];
  etapas?: TiemposEtapa;
  observaciones?: ObservacionesResumen;
  uso: UsoRegina[] = [];

  // --- opciones de los combos, sacadas de los datos que existen
  personas: OpcionFiltro[] = [];
  centrosInternos: OpcionFiltro[] = [];
  centrosProyecto: OpcionFiltro[] = [];

  // --- buscador de persona: se escribe y la lista se achica
  personaTexto = '';
  mostrarPersonas = false;
  indicePersona = -1;
  private cerrarPersonasTimer: any;

  // --- lo mismo para el centro de costos
  centroTexto = '';
  mostrarCentros = false;
  indiceCentro = -1;
  private cerrarCentrosTimer: any;

  /**
   * Los cinco estados del recorrido.
   *
   * No son los de la columna ESTADO —que solo distingue abierta, rendida y
   * rechazada— sino los que se deducen de las fechas. La regla vive en el
   * backend y esta lista es su reflejo: si cambia allá, cambia acá.
   */
  readonly estados = [
    { valor: '',             etiqueta: 'Todos' },
    { valor: 'PENDIENTE',    etiqueta: 'Pendiente' },
    { valor: 'EN_PROCESO',   etiqueta: 'En proceso' },
    { valor: 'RECEPCIONADO', etiqueta: 'Recepcionado' },
    { valor: 'OBSERVADO',    etiqueta: 'Observado' },
    { valor: 'LIQUIDADO',    etiqueta: 'Liquidado' },
  ];

  /** Lo que significa cada estado. Se muestra al lado del filtro. */
  readonly explicaciones: Record<string, string> = {
    PENDIENTE:    'Desde que se creó la OP hasta que el usuario la envía a contabilidad.',
    EN_PROCESO:   'Desde el envío a contabilidad hasta que marcan que llegaron los físicos.',
    RECEPCIONADO: 'Contabilidad confirmó que recibió los comprobantes físicos.',
    OBSERVADO:    'Contabilidad marcó al menos un comprobante como que no sustenta.',
    LIQUIDADO:    'La orden quedó liquidada en el ERP. Lo detecta REGINA sola.',
  };

  get explicacionDelEstado(): string {
    return this.explicaciones[this.filtro.estado] ?? '';
  }

  buscoAlgunaVez = false;
  mensajeError = '';

  /** Paginado de la tabla de tiempos, que es la única que puede ser larga. */
  paginaActual = 0;
  readonly tamanioPagina = 15;

  generandoPdf = false;

  constructor(
    private servicio: ReporteRendicionService,
    private reportsService: ReportsService,
    private loadingService: LoadingService,
    private ruta: ActivatedRoute,
    private location: Location
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  /**
   * El mes en curso completo: del día 1 al último día del mes.
   *
   * Se toma el mes entero y no "hasta hoy" porque contabilidad trabaja por
   * período: un corte a mitad de mes cambia solo, y lo que se miró ayer no da
   * lo mismo que hoy. El fin de mes se calcula pidiendo el día 0 del mes
   * siguiente, que es el último del actual — así sale bien en febrero y en
   * los años bisiestos sin tabla de días.
   *
   * Las fechas se arman con los componentes locales y no con toISOString, que
   * pasa a UTC y en Lima devuelve el día anterior.
   */
  private ponerRangoPorDefecto(): void {
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    this.filtro.desde = this.aISO(primero);
    this.filtro.hasta = this.aISO(ultimo);
  }

  /** yyyy-MM-dd con la fecha local, que es lo que espera un input date. */
  private aISO(f: Date): string {
    const mes = String(f.getMonth() + 1).padStart(2, '0');
    const dia = String(f.getDate()).padStart(2, '0');
    return `${f.getFullYear()}-${mes}-${dia}`;
  }

  ngOnInit(): void {
    this.ponerRangoPorDefecto();

    const pedida = this.ruta.snapshot.queryParamMap.get('vista');
    const validas: Vista[] = ['resumen', 'usuarios', 'centros', 'tiempos', 'observaciones', 'uso'];
    if (pedida && (validas as string[]).includes(pedida)) {
      this.vista = pedida as Vista;
    }
    this.cargarOpciones();
    this.buscar();
  }

  /**
   * Llena los combos con lo que hay en los datos.
   *
   * Su fallo no bloquea la pantalla: los reportes siguen andando sin
   * filtros, que es mejor que una pantalla vacía por un combo.
   */
  private cargarOpciones(): void {
    this.servicio.opciones(this.codEmpresa, this.codSucursal).subscribe({
      next: (o) => {
        this.personas = o?.personas ?? [];
        const centros = o?.centros ?? [];
        this.centrosInternos = centros.filter(c => c.grupo === 'Areas internas');
        this.centrosProyecto = centros.filter(c => c.grupo !== 'Areas internas');
      },
      error: (err) => console.error('[reportes] no se pudieron cargar los filtros:', err)
    });
  }

  /**
   * Las personas que coinciden con lo tecleado.
   *
   * Busca por cualquier parte del nombre, no solo por el principio: la lista
   * viene como "APELLIDO, Nombre" y la gente teclea el nombre de pila tanto
   * como el apellido. Sin espacios ni mayúsculas de por medio, porque nadie
   * escribe los apellidos igual que como están cargados.
   */
  get personasFiltradas(): OpcionFiltro[] {
    const texto = this.normalizar(this.personaTexto);
    if (!texto) {
      return this.personas;
    }
    return this.personas.filter(p => this.normalizar(p.etiqueta).includes(texto));
  }

  private normalizar(valor: string): string {
    return (valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // saca tildes: "GARCIA" encuentra "GARCÍA"
      .trim();
  }

  abrirPersonas(): void {
    if (this.cerrarPersonasTimer) { clearTimeout(this.cerrarPersonasTimer); }
    this.mostrarPersonas = true;
    this.indicePersona = -1;
  }

  /**
   * Cierra la lista, con un respiro.
   *
   * El blur del input llega antes que el click en la opción; cerrar de
   * inmediato haría que el primer clic no seleccione nada y el usuario
   * tenga que hacerlo dos veces.
   */
  cerrarPersonas(): void {
    this.cerrarPersonasTimer = setTimeout(() => {
      this.mostrarPersonas = false;
      this.indicePersona = -1;
      // Si quedó texto escrito que no corresponde a nadie elegido, se
      // limpia: dejarlo daría la impresión de un filtro que no está puesto.
      if (!this.filtro.userId) { this.personaTexto = ''; }
    }, 180);
  }

  alTeclearPersona(): void {
    this.mostrarPersonas = true;
    this.indicePersona = -1;
    // Escribir invalida la selección anterior: el texto y el filtro no
    // pueden decir cosas distintas.
    if (this.filtro.userId) { this.filtro.userId = ''; }
  }

  elegirPersona(p: OpcionFiltro): void {
    if (this.cerrarPersonasTimer) { clearTimeout(this.cerrarPersonasTimer); }
    this.filtro.userId = p.valor;
    this.personaTexto = p.etiqueta;
    this.mostrarPersonas = false;
    this.indicePersona = -1;
    this.buscar();
  }

  limpiarPersona(): void {
    this.filtro.userId = '';
    this.personaTexto = '';
    this.mostrarPersonas = false;
    this.buscar();
  }

  /** Flechas para recorrer, Enter para elegir, Escape para cerrar. */
  teclaEnPersona(evento: KeyboardEvent): void {
    const lista = this.personasFiltradas;

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      this.mostrarPersonas = true;
      this.indicePersona = Math.min(this.indicePersona + 1, lista.length - 1);

    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.indicePersona = Math.max(this.indicePersona - 1, 0);

    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      // Sin nada resaltado pero con una sola coincidencia, se elige esa:
      // es lo que el usuario quiere cuando terminó de escribir un apellido.
      const elegida = this.indicePersona >= 0 ? lista[this.indicePersona]
                    : (lista.length === 1 ? lista[0] : undefined);
      if (elegida) { this.elegirPersona(elegida); }

    } else if (evento.key === 'Escape') {
      this.mostrarPersonas = false;
      this.indicePersona = -1;
    }
  }

  /**
   * Los centros que coinciden con lo tecleado.
   *
   * Busca en la descripcion y tambien en el codigo: contabilidad los conoce
   * por numero y el resto por el nombre del cliente. Un buscador que solo
   * mire uno de los dos deja afuera a la mitad de la gente.
   *
   * <p>Se ordenan las areas internas primero, igual que en el combo: son una
   * docena contra casi doscientos proyectos, y sin ese orden desaparecen.
   */
  get centrosFiltrados(): OpcionFiltro[] {
    const texto = this.normalizar(this.centroTexto);
    const todos = [...this.centrosInternos, ...this.centrosProyecto];
    if (!texto) {
      return todos;
    }
    return todos.filter(c =>
      this.normalizar(c.etiqueta).includes(texto) || c.valor.includes(texto));
  }

  abrirCentros(): void {
    if (this.cerrarCentrosTimer) { clearTimeout(this.cerrarCentrosTimer); }
    this.mostrarCentros = true;
    this.indiceCentro = -1;
  }

  cerrarCentros(): void {
    this.cerrarCentrosTimer = setTimeout(() => {
      this.mostrarCentros = false;
      this.indiceCentro = -1;
      if (!this.filtro.codCCostos) { this.centroTexto = ''; }
    }, 180);
  }

  alTeclearCentro(): void {
    this.mostrarCentros = true;
    this.indiceCentro = -1;
    if (this.filtro.codCCostos) { this.filtro.codCCostos = ''; }
  }

  elegirCentro(c: OpcionFiltro): void {
    if (this.cerrarCentrosTimer) { clearTimeout(this.cerrarCentrosTimer); }
    this.filtro.codCCostos = c.valor;
    this.centroTexto = c.etiqueta;
    this.mostrarCentros = false;
    this.indiceCentro = -1;
    this.buscar();
  }

  limpiarCentro(): void {
    this.filtro.codCCostos = '';
    this.centroTexto = '';
    this.mostrarCentros = false;
    this.buscar();
  }

  teclaEnCentro(evento: KeyboardEvent): void {
    const lista = this.centrosFiltrados;

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      this.mostrarCentros = true;
      this.indiceCentro = Math.min(this.indiceCentro + 1, lista.length - 1);

    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.indiceCentro = Math.max(this.indiceCentro - 1, 0);

    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      const elegido = this.indiceCentro >= 0 ? lista[this.indiceCentro]
                    : (lista.length === 1 ? lista[0] : undefined);
      if (elegido) { this.elegirCentro(elegido); }

    } else if (evento.key === 'Escape') {
      this.mostrarCentros = false;
      this.indiceCentro = -1;
    }
  }

  cambiarVista(v: Vista): void {
    if (this.vista === v) {
      return;
    }
    this.vista = v;
    this.paginaActual = 0;
    this.buscar();
  }

  buscar(): void {
    this.mensajeError = '';
    this.loadingService.show();

    const listo = () => {
      this.buscoAlgunaVez = true;
      this.loadingService.hide();
    };

    // Cada pestaña pide solo lo suyo: traer los tres reportes cuando el
    // usuario mira uno es trabajo de servidor que nadie va a ver.
    const fallo = (err: any) => {
      console.error('[reportes-rendicion] no se pudo obtener el reporte:', err);
      this.mensajeError = err?.error?.mensaje
        ?? 'No se pudo obtener el reporte. Intentá de nuevo en unos minutos.';
      listo();
    };

    switch (this.vista) {
      case 'resumen':
        this.servicio.resumen(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({ next: r => { this.resumen = r; listo(); }, error: fallo });
        break;

      case 'usuarios':
        this.servicio.porUsuario(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({ next: r => { this.usuarios = r ?? []; listo(); }, error: fallo });
        break;

      case 'centros':
        this.servicio.porCentroCosto(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({ next: r => { this.centros = r ?? []; listo(); }, error: fallo });
        break;

      case 'observaciones':
        this.servicio.observaciones(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({ next: r => { this.observaciones = r; listo(); }, error: fallo });
        break;

      case 'uso':
        this.servicio.uso(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({ next: r => { this.uso = r ?? []; listo(); }, error: fallo });
        break;

      default:
        // Las etapas van aparte y su fallo no tumba la tabla: son dos
        // preguntas distintas, y quedarse sin el detalle porque el resumen
        // falló sería perder lo que sí se puede mostrar.
        this.servicio.etapas(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({
            next: e => this.etapas = e,
            error: e => console.error('[reportes] no se pudieron obtener las etapas:', e)
          });

        this.servicio.tiemposPorOrden(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({
            next: r => { this.tiemposOrden = r ?? []; this.paginaActual = 0; listo(); },
            error: fallo
          });
    }
  }

  limpiar(): void {
    this.filtro = new FiltroReporte();
    this.ponerRangoPorDefecto();
    this.personaTexto = '';
    this.centroTexto = '';
    this.mostrarPersonas = false;
    this.mostrarCentros = false;
    this.buscar();
  }

  volver(): void {
    this.location.back();
  }

  // ------------------------------------------------------------ tiempos

  get paginaTiempos(): TiempoOrden[] {
    const desde = this.paginaActual * this.tamanioPagina;
    return this.tiemposOrden.slice(desde, desde + this.tamanioPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.tiemposOrden.length / this.tamanioPagina);
  }

  irAPagina(p: number): void {
    if (p >= 0 && p < this.totalPaginas) {
      this.paginaActual = p;
    }
  }

  /**
   * Cuánto tarda en promedio una orden desde que se crea hasta hoy o hasta
   * que se liquida. Es el número que resume la tabla entera.
   */
  get promedioDias(): number {
    const conDato = this.tiemposOrden.filter(t => t.diasTotal != null);
    if (!conDato.length) {
      return 0;
    }
    const suma = conDato.reduce((acc, t) => acc + (t.diasTotal ?? 0), 0);
    return Math.round((suma / conDato.length) * 10) / 10;
  }

  /** La orden que más lleva. Es el caso que la gente quiere ver primero. */
  get peorEspera(): TiempoOrden | undefined {
    return this.tiemposOrden.reduce<TiempoOrden | undefined>(
      (peor, t) => (!peor || (t.diasTotal ?? 0) > (peor.diasTotal ?? 0)) ? t : peor,
      undefined);
  }

  /** La pastilla del estado del recorrido, con los colores de la leyenda. */
  claseProceso(estado?: string): string {
    switch (estado) {
      case 'LIQUIDADO':    return 'p-liq';
      case 'OBSERVADO':    return 'p-obs';
      case 'RECEPCIONADO': return 'p-recep';
      case 'EN_PROCESO':   return 'p-proc';
      default:             return 'p-pend';
    }
  }

  /** Verde hasta 9 dias, ambar hasta 20, rojo mas alla. */
  claseDias(dias?: number): string {
    if (dias == null) { return ''; }
    if (dias <= 9)  { return 'd-ok'; }
    if (dias <= 20) { return 'd-medio'; }
    return 'd-tarde';
  }

  /** Cuántas siguen con el reloj corriendo: el recorrido no terminó. */
  get ordenesEnCurso(): number {
    return this.tiemposOrden.filter(t => t.enCurso).length;
  }

  /** Verde hasta 3 días, ámbar hasta 10, rojo más allá. */
  colorDeEspera(dias?: number): string {
    if (dias == null) { return ''; }
    if (dias <= 3) { return 'espera-ok'; }
    if (dias <= 10) { return 'espera-media'; }
    return 'espera-alta';
  }

  // ------------------------------------------------------------ uso

  /**
   * El universo del reporte son las personas que tienen algo que rendir en
   * el rango, no el padrón de usuarios. Contar los 135 usuarios del sistema
   * daba 128 "sin uso" que en su mayoría nunca recibieron una orden: ese
   * número no medía nada y tapaba los pocos casos reales.
   */
  get personasConOrden(): number {
    return this.uso.length;
  }

  /**
   * Recibieron plata a rendir y no cargaron ni una rendición.
   *
   * Los campos van con ?? 0 a propósito: si el API todavía es el anterior no
   * los manda, y sin la guarda las tarjetas mostraban NaN en vez de quedarse
   * en cero mientras el backend termina de subir.
   */
  get personasSinRendir(): number {
    return this.uso.filter(u => (u.ordenesAsignadas ?? 0) > 0
                             && (u.ordenesRendidas ?? 0) === 0).length;
  }

  /** El total de entregas que siguen sin rendición cargada. */
  get ordenesSinRendir(): number {
    return this.uso.reduce(
      (t, u) => t + Math.max(0, (u.ordenesAsignadas ?? 0) - (u.ordenesRendidas ?? 0)), 0);
  }

  /** Personas con orden de pago a las que no se les conoce usuario REGINA. */
  get personasSinUsuario(): number {
    return this.uso.filter(u => u.sinUsuario === true).length;
  }

  /** Verde desde 80%, ámbar desde 40%, rojo abajo. */
  claseRendido(p?: number): string {
    if (p == null) { return ''; }
    if (p >= 80) { return 'd-ok'; }
    if (p >= 40) { return 'd-medio'; }
    return 'd-tarde';
  }

  get sinUso(): number {
    return this.uso.filter(u => u.nivel === 'SIN_USO').length;
  }

  get usoBajo(): number {
    return this.uso.filter(u => u.nivel === 'BAJO').length;
  }

  get usoActivo(): number {
    return this.uso.filter(u => u.nivel === 'ACTIVO').length;
  }

  etiquetaNivel(nivel: string): string {
    if (nivel === 'SIN_USO') { return 'Sin uso'; }
    if (nivel === 'BAJO') { return 'Uso bajo'; }
    return 'Activo';
  }

  claseNivel(nivel: string): string {
    if (nivel === 'SIN_USO') { return 'nivel-sin'; }
    if (nivel === 'BAJO') { return 'nivel-bajo'; }
    return 'nivel-activo';
  }

  // ------------------------------------------------------------ gerencial

  /**
   * El PDF con todo el panorama, no solo la pestaña abierta.
   *
   * Un reporte que va a una gerencia tiene que responder las seis preguntas
   * juntas; entregar "lo que estabas mirando" obliga a generar seis PDF y
   * pegarlos. Por eso se piden los seis reportes en paralelo antes de armarlo.
   *
   * <p>Cada consulta cae en null si falla, y el PDF sale igual con las
   * secciones que sí respondieron: quedarse sin reporte porque una de seis
   * falló es peor que un reporte con una sección en blanco.
   */
  exportarGerencial(): void {
    if (this.generandoPdf) { return; }
    this.generandoPdf = true;
    this.loadingService.show();

    const e = this.codEmpresa;
    const s = this.codSucursal;
    const f = this.filtro;
    const sinFallar = <T>(o: Observable<T>) => o.pipe(catchError(() => of(null as any)));

    forkJoin({
      resumen:       sinFallar(this.servicio.resumen(e, s, f)),
      usuarios:      sinFallar(this.servicio.porUsuario(e, s, f)),
      centros:       sinFallar(this.servicio.porCentroCosto(e, s, f)),
      observaciones: sinFallar(this.servicio.observaciones(e, s, f)),
      etapas:        sinFallar(this.servicio.etapas(e, s, f)),
      uso:           sinFallar(this.servicio.uso(e, s, f)),
      tiempos:       sinFallar(this.servicio.tiempos(e, s, f, 5000)),
    }).subscribe({
      next: (r) => {
        this.reportsService.reporteGerencialRendicion(this.armarGerencial(r))
          .subscribe(() => {
            this.generandoPdf = false;
            this.loadingService.hide();
          });
      },
      error: (err) => {
        this.generandoPdf = false;
        this.loadingService.hide();
        console.error('[reportes] no se pudo armar el reporte gerencial:', err);
      }
    });
  }

  private armarGerencial(r: any): DatosGerenciales {
    const resumen: ResumenRendiciones | null = r.resumen;
    const obs: ObservacionesResumen | null = r.observaciones;
    const etapas: TiemposEtapa | null = r.etapas;
    const uso: UsoRegina[] = r.uso ?? [];
    const tiempos: TiempoComprobante[] = r.tiempos ?? [];

    // El promedio de carga a envío se calcula acá y no en el backend porque
    // ese dato es por comprobante y el resto viene por rendición.
    const conEspera = tiempos.filter(t => t.diasEspera != null);
    const diasCargaAEnvio = conEspera.length
      ? Math.round((conEspera.reduce((a, t) => a + (t.diasEspera ?? 0), 0) / conEspera.length) * 10) / 10
      : null;

    const sinUso = uso.filter(u => u.nivel === 'SIN_USO');

    return {
      alcance: this.textoDelAlcance(),
      desdeCuando: resumen?.hayDatosDesde
        ? `La antesala registra desde el ${new Date(resumen.hayDatosDesde).toLocaleDateString('es-PE')}. Un corte anterior sale en cero por falta de registro, no de actividad.`
        : undefined,

      recibidas: resumen?.recibidas ?? 0,
      abiertas: resumen?.abiertas ?? 0,
      rechazadas: resumen?.rechazadas ?? 0,
      comprobantes: resumen?.comprobantes ?? 0,
      importeSoles: resumen?.importeSoles ?? 0,
      personas: resumen?.usuarios ?? 0,

      // Null y no cero cuando no hay ninguna rendición en el período: 0%
      // diría "no hay observaciones", que es lo contrario de "no hay nada".
      porcentajeObservadas: obs && obs.rendicionesPeriodo > 0
        ? obs.porcentajeRendiciones : null,

      diasCargaAEnvio,
      diasEnvioARecepcion: etapas?.diasEnvioARecepcion ?? null,
      diasProcesoALiquidacion: etapas?.diasProcesoALiquidacion ?? null,
      diasEnvioALiquidacion: etapas?.diasEnvioALiquidacion ?? null,

      usuarios: (r.usuarios ?? []).map((u: RendicionPorUsuario) => ({
        usuario: u.usuario,
        rendiciones: u.rendiciones,
        comprobantes: u.comprobantes,
        importeSoles: u.importeSoles,
        ultimoEnvio: u.ultimoEnvio,
      })),
      centros: (r.centros ?? []).map((c: RendicionPorCentroCosto) => ({
        desCCostos: c.desCCostos,
        rendiciones: c.rendiciones,
        comprobantes: c.comprobantes,
        importeSoles: c.importeSoles,
        porcentaje: c.porcentaje,
      })),
      motivos: (obs?.motivos ?? []).map(m => ({
        desMotivo: m.desMotivo,
        veces: m.veces,
        importe: m.importe,
        porcentaje: m.porcentaje,
      })),

      sinUso: sinUso.length,
      usoBajo: uso.filter(u => u.nivel === 'BAJO').length,
      usoActivo: uso.filter(u => u.nivel === 'ACTIVO').length,
      // Se cortan en 25: una lista de cien nombres en un PDF gerencial no se
      // lee, y el número de arriba ya da la magnitud.
      sinUsoNombres: sinUso.slice(0, 25).map(u => u.usuario),
    };
  }

  /** El periodo y los filtros, en una linea que se pueda citar. */
  private textoDelAlcance(): string {
    const partes: string[] = [];

    if (this.filtro.desde || this.filtro.hasta) {
      const desde = this.filtro.desde ? this.aFechaCorta(this.filtro.desde) : 'el inicio';
      const hasta = this.filtro.hasta ? this.aFechaCorta(this.filtro.hasta) : 'hoy';
      partes.push(`Periodo: de ${desde} a ${hasta}`);
    } else {
      partes.push('Periodo: todo el historial');
    }

    if (this.personaTexto && this.filtro.userId) { partes.push(`Persona: ${this.personaTexto}`); }
    if (this.centroTexto && this.filtro.codCCostos) { partes.push(`Centro: ${this.centroTexto}`); }
    if (this.filtro.estado) { partes.push(`Estado: ${this.filtro.estado}`); }

    return partes.join('  ·  ');
  }

  private aFechaCorta(iso: string): string {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  /**
   * Verde hasta 20% pendiente, ámbar hasta 50, rojo más allá.
   *
   * El corte no es caprichoso: por debajo del 20 suele ser el redondeo de una
   * rendición en curso; por encima del 50 es plata que sigue afuera.
   */
  clasePendiente(porcentaje?: number): string {
    if (porcentaje == null) { return ''; }
    if (porcentaje <= 20) { return 'd-ok'; }
    if (porcentaje <= 50) { return 'd-medio'; }
    return 'd-tarde';
  }

  // ------------------------------------------------------------ descarga

  /** El usuario logueado, para que el reporte diga quién lo generó. */
  private get usuarioActual(): string {
    try {
      const guardado = sessionStorage.getItem('user');
      if (!guardado) { return ''; }
      const u = JSON.parse(guardado);
      return u?.userUsername ?? u?.username ?? '';
    } catch {
      return '';
    }
  }

  /** El nombre de la pestaña, tal como se ve en la solapa. */
  private get tituloVista(): string {
    switch (this.vista) {
      case 'usuarios':      return 'Rendiciones por usuario';
      case 'centros':       return 'Gasto por centro de costos';
      case 'tiempos':       return 'Tiempo de carga a envío';
      case 'observaciones': return 'Motivos de observación';
      case 'uso':           return 'Uso de REGINA';
      default:              return 'Rendiciones recibidas';
    }
  }

  private get archivoVista(): string {
    switch (this.vista) {
      case 'usuarios':      return 'rendiciones_por_usuario';
      case 'centros':       return 'gasto_por_centro_de_costos';
      case 'tiempos':       return 'tiempo_de_carga_a_envio';
      case 'observaciones': return 'motivos_de_observacion';
      case 'uso':           return 'uso_de_regina';
      default:              return 'rendiciones_recibidas';
    }
  }

  /** Los filtros aplicados, tal como se imprimen arriba del reporte. */
  private chipsDeFiltros(): string[] {
    const c: string[] = [];
    if (this.filtro.desde) { c.push(`desde: ${this.filtro.desde}`); }
    if (this.filtro.hasta) { c.push(`hasta: ${this.filtro.hasta}`); }
    if (this.personaTexto) { c.push(`personal: ${this.personaTexto}`); }
    if (this.centroTexto) { c.push(`centro: ${this.centroTexto}`); }
    if (this.filtro.estado) {
      const e = this.estados.find(x => x.valor === this.filtro.estado);
      c.push(`estado: ${e?.etiqueta ?? this.filtro.estado}`);
    }
    return c;
  }

  descargarExcel(): void {
    this.servicio.excel(this.codEmpresa, this.codSucursal, this.vista,
                        this.filtro, this.usuarioActual).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.archivoVista}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: e => {
        console.error('[reportes-rendicion] no se pudo bajar el Excel:', e);
        this.mensajeError = 'No se pudo generar el Excel. Intentá de nuevo en un momento.';
      }
    });
  }

  /**
   * La pestaña que se está viendo, en PDF.
   *
   * El armado —marca, filtros, tarjetas, tabla, pie— vive en ReportePdf y lo
   * comparten todos los reportes. Acá solo se decide qué va en cada parte.
   */
  descargarPDF(): void {
    const pdf = new ReportePdf(this.vista === 'resumen' ? 'portrait' : 'landscape');

    pdf.cabecera({
      reporte: this.tituloVista,
      empresa: this.codEmpresa,
      usuario: this.usuarioActual
    }).filtros(this.chipsDeFiltros());

    switch (this.vista) {
      case 'usuarios':      this.pdfUsuarios(pdf); break;
      case 'centros':       this.pdfCentros(pdf); break;
      case 'tiempos':       this.pdfTiempos(pdf); break;
      case 'observaciones': this.pdfObservaciones(pdf); break;
      case 'uso':           this.pdfUso(pdf); break;
      default:              this.pdfResumen(pdf); break;
    }

    pdf.guardar(`${this.archivoVista}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /**
   * El resumen no es una lista: va como tarjetas más dos bloques, el recorrido
   * y los totales. Forzarlo a una sola tabla mezclaría cantidades con importes
   * en la misma columna, que es como se leen mal los reportes.
   */
  private pdfResumen(pdf: ReportePdf): void {
    const r = this.resumen;
    if (!r) { pdf.nota('No hay datos para este período.'); return; }

    const tarjetas: TarjetaPdf[] = [
      { rotulo: 'RECIBIDAS', valor: String(r.recibidas), color: [37, 78, 138] },
      { rotulo: 'PENDIENTES', valor: String(r.pendientes), color: [176, 132, 24] },
      { rotulo: 'OBSERVADAS', valor: String(r.observadas), color: [176, 68, 45] },
      { rotulo: 'LIQUIDADAS', valor: String(r.liquidadas), color: [37, 118, 74] },
    ];
    pdf.tarjetas(tarjetas);

    const cols: ColumnaPdf[] = [
      { titulo: 'Estado', ancho: 240, alineacion: 'l' },
      { titulo: 'Rendiciones', ancho: 100, alineacion: 'r' },
    ];

    pdf.seccion('El recorrido').tabla(cols, [
      ['Pendientes (sin enviar)', String(r.pendientes)],
      ['En proceso', String(r.enProceso)],
      ['Recepcionadas', String(r.recepcionadas)],
      ['Observadas', String(r.observadas)],
      ['Liquidadas', String(r.liquidadas)],
    ], ['Recibidas por contabilidad', String(r.recibidas)]);

    pdf.seccion('Totales del período').tabla([
      { titulo: 'Concepto', ancho: 240, alineacion: 'l' },
      { titulo: 'Valor', ancho: 100, alineacion: 'r' },
    ], [
      ['Comprobantes', String(r.comprobantes)],
      ['Importe en soles', nro(r.importeSoles)],
      ['Importe en dólares', nro(r.importeDolares)],
      ['Personas distintas', String(r.usuarios)],
      ['Primer envío', fmtFecha(r.primerEnvio)],
      ['Último envío', fmtFecha(r.ultimoEnvio)],
    ]);

    if (r.hayDatosDesde) {
      pdf.nota(`La antesala registra desde el ${fmtFecha(r.hayDatosDesde)}. `
        + 'Un corte anterior sale en cero por falta de registro, no de actividad.');
    }
  }

  private pdfUsuarios(pdf: ReportePdf): void {
    const cols: ColumnaPdf[] = [
      { titulo: 'Usuario', ancho: 160, alineacion: 'l' },
      { titulo: 'Rend.', ancho: 38, alineacion: 'c' },
      { titulo: 'Comp.', ancho: 40, alineacion: 'c' },
      { titulo: 'Entregado S/', ancho: 78, alineacion: 'r' },
      { titulo: 'Rendido S/', ancho: 78, alineacion: 'r' },
      { titulo: '% pend.', ancho: 52, alineacion: 'r' },
      { titulo: 'Pend.', ancho: 40, alineacion: 'c' },
      { titulo: 'En proc.', ancho: 50, alineacion: 'c' },
      { titulo: 'Recep.', ancho: 48, alineacion: 'c' },
      { titulo: 'Obs.', ancho: 42, alineacion: 'c' },
      { titulo: 'Liq.', ancho: 42, alineacion: 'c' },
      { titulo: 'Primer envío', ancho: 72, alineacion: 'c' },
      { titulo: 'Último envío', ancho: 72, alineacion: 'c' },
    ];
    const filas = this.usuarios.map(u => [
      u.usuario, String(u.rendiciones), String(u.comprobantes),
      u.importeEntregado == null ? '—' : nro(u.importeEntregado),
      nro(u.importeSoles),
      u.porcentajePendiente == null ? '—' : nro(u.porcentajePendiente) + ' %',
      String(u.pendientes ?? 0), String(u.enProceso ?? 0), String(u.recepcionadas ?? 0),
      String(u.observadas ?? 0), String(u.liquidadas ?? 0),
      fmtFecha(u.primerEnvio), fmtFecha(u.ultimoEnvio)
    ]);

    const totalRend = this.usuarios.reduce((s, u) => s + u.rendiciones, 0);
    const totalComp = this.usuarios.reduce((s, u) => s + u.comprobantes, 0);
    const totalEnt = this.usuarios.reduce((s, u) => s + (u.importeEntregado ?? 0), 0);
    const totalImp = this.usuarios.reduce((s, u) => s + (u.importeSoles ?? 0), 0);
    // El porcentaje del total se calcula sobre los totales, no promediando
    // los porcentajes de cada fila: promediar porcentajes le da el mismo peso
    // a quien rindió cincuenta soles que a quien rindió cinco mil.
    const pendTotal = totalEnt > 0
      ? nro(Math.max(0, totalEnt - totalImp) * 100 / totalEnt) + ' %'
      : '—';

    pdf.seccion('Detalle por persona')
       .tabla(cols, filas, ['TOTAL', String(totalRend), String(totalComp),
                            nro(totalEnt), nro(totalImp), pendTotal]);
  }

  private pdfCentros(pdf: ReportePdf): void {
    const cols: ColumnaPdf[] = [
      { titulo: 'Código', ancho: 80, alineacion: 'l' },
      { titulo: 'Centro de costos', ancho: 330, alineacion: 'l' },
      { titulo: 'Rend.', ancho: 55, alineacion: 'c' },
      { titulo: 'Comp.', ancho: 55, alineacion: 'c' },
      { titulo: 'Importe S/', ancho: 90, alineacion: 'r' },
      { titulo: '% del total', ancho: 70, alineacion: 'r' },
    ];
    const filas = this.centros.map(c => [
      c.codCCostos, c.desCCostos, String(c.rendiciones), String(c.comprobantes),
      nro(c.importeSoles), nro(c.porcentaje) + ' %'
    ]);
    const totalImp = this.centros.reduce((s, c) => s + (c.importeSoles ?? 0), 0);

    pdf.seccion('Detalle por centro de costos')
       .tabla(cols, filas, ['TOTAL', '', '', '', nro(totalImp), '']);
  }

  private pdfTiempos(pdf: ReportePdf): void {
    const cols: ColumnaPdf[] = [
      { titulo: 'Orden', ancho: 62, alineacion: 'l' },
      { titulo: 'Personal', ancho: 135, alineacion: 'l' },
      { titulo: 'Estado', ancho: 70, alineacion: 'c' },
      { titulo: 'Creada', ancho: 58, alineacion: 'c' },
      { titulo: 'Enviada', ancho: 58, alineacion: 'c' },
      { titulo: 'Recepc.', ancho: 58, alineacion: 'c' },
      { titulo: 'Liquidada', ancho: 58, alineacion: 'c' },
      { titulo: 'Pend.', ancho: 46, alineacion: 'r' },
      { titulo: 'En proc.', ancho: 50, alineacion: 'r' },
      { titulo: 'En recep.', ancho: 52, alineacion: 'r' },
      { titulo: 'Total', ancho: 46, alineacion: 'r' },
    ];

    const dias = (v?: number) => v == null ? '—' : nro(v) + ' d';

    const filas = this.tiemposOrden.map(t => [
      t.numOrden, (t.usuario || '').substring(0, 34), t.etiquetaProceso ?? '',
      fmtFecha(t.fecCreada), fmtFecha(t.fecEnviada),
      fmtFecha(t.fecRecepcionada), fmtFecha(t.fecLiquidada),
      dias(t.diasPendiente), dias(t.diasEnProceso),
      dias(t.diasEnRecepcion), dias(t.diasTotal)
    ]);

    pdf.seccion('El recorrido de cada orden')
       .tabla(cols, filas)
       .nota('Los tramos que todavía no terminaron siguen corriendo hasta hoy: '
           + `${this.ordenesEnCurso} de ${this.tiemposOrden.length} órdenes están en curso.`);
  }

  private pdfObservaciones(pdf: ReportePdf): void {
    const o = this.observaciones;
    if (!o) { pdf.nota('No hay observaciones en este período.'); return; }

    pdf.tarjetas([
      { rotulo: 'RENDICIONES CON OBSERVACIÓN', valor: String(o.rendicionesConObservacion),
        pie: `de ${o.rendicionesPeriodo} del período`, color: [176, 68, 45] },
      { rotulo: 'COMPROBANTES OBSERVADOS', valor: String(o.comprobantesObservados),
        pie: `de ${o.comprobantes}`, color: [176, 132, 24] },
      { rotulo: 'IMPORTE OBSERVADO', valor: 'S/ ' + nro(o.importeObservado), color: [37, 78, 138] },
      { rotulo: 'RECHAZADAS', valor: String(o.rendicionesRechazadas), color: [110, 118, 130] },
    ]);

    pdf.seccion('Por qué se observa').tabla([
      { titulo: 'Motivo', ancho: 330, alineacion: 'l' },
      { titulo: 'Veces', ancho: 70, alineacion: 'c' },
      { titulo: 'Importe S/', ancho: 100, alineacion: 'r' },
      { titulo: '% de las observaciones', ancho: 130, alineacion: 'r' },
    ], (o.motivos ?? []).map(m => [
      m.desMotivo, String(m.veces), nro(m.importe), nro(m.porcentaje) + ' %'
    ]));

    // El motivo dice que se observa; esto dice a quien. Sin la segunda tabla
    // el reporte no permite hacer nada al respecto.
    pdf.seccion('Quién acumula las observaciones').tabla([
      { titulo: 'Personal', ancho: 250, alineacion: 'l' },
      { titulo: 'Rendiciones', ancho: 80, alineacion: 'c' },
      { titulo: 'Comprobantes', ancho: 90, alineacion: 'c' },
      { titulo: 'Importe S/', ancho: 100, alineacion: 'r' },
      { titulo: '% de las observaciones', ancho: 110, alineacion: 'r' },
    ], (o.porPersona ?? []).map(x => [
      x.usuario, String(x.rendiciones), String(x.comprobantesObservados),
      nro(x.importe), nro(x.porcentaje) + ' %'
    ]));
  }

  private pdfUso(pdf: ReportePdf): void {
    const tarjetas: TarjetaPdf[] = [
      { rotulo: 'CON OP', valor: String(this.personasConOrden), color: [37, 78, 138] },
      { rotulo: 'SIN RENDIR', valor: String(this.personasSinRendir), color: [176, 68, 45] },
      { rotulo: 'OP SIN RENDIR', valor: String(this.ordenesSinRendir), color: [176, 132, 24] },
      { rotulo: 'SIN USUARIO', valor: String(this.personasSinUsuario), color: [61, 63, 69] },
    ];
    pdf.tarjetas(tarjetas);

    const cols: ColumnaPdf[] = [
      { titulo: 'Cód.', ancho: 55, alineacion: 'l' },
      { titulo: 'Personal', ancho: 200, alineacion: 'l' },
      { titulo: 'OP', ancho: 40, alineacion: 'c' },
      { titulo: 'Rendidas', ancho: 55, alineacion: 'c' },
      { titulo: '% rend.', ancho: 55, alineacion: 'c' },
      { titulo: 'Usuario', ancho: 55, alineacion: 'c' },
      { titulo: 'Comp.', ancho: 45, alineacion: 'c' },
      { titulo: 'Última rendición', ancho: 90, alineacion: 'c' },
    ];
    const filas = this.uso.map(u => [
      u.codAuxiliar ?? '', u.usuario,
      String(u.ordenesAsignadas ?? 0), String(u.ordenesRendidas ?? 0),
      u.porcentajeRendido != null ? `${u.porcentajeRendido}%` : '—',
      u.sinUsuario ? 'NO' : 'Sí',
      String(u.comprobantes), fmtFecha(u.ultimaRendicion)
    ]);
    pdf.seccion('Personas con órdenes de pago en el período').tabla(cols, filas);
    pdf.nota('El universo son las personas con entregas a rendir en el rango, '
           + 'no el padrón completo de usuarios. "Usuario NO" es alguien que '
           + 'recibió plata y no tiene acceso conocido a REGINA.');
  }
}
