import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
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

  ngOnInit(): void {
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

        this.servicio.tiempos(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({
            next: r => { this.tiempos = r ?? []; this.paginaActual = 0; listo(); },
            error: fallo
          });
    }
  }

  limpiar(): void {
    this.filtro = new FiltroReporte();
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

  get paginaDeTiempos(): TiempoComprobante[] {
    const desde = this.paginaActual * this.tamanioPagina;
    return this.tiempos.slice(desde, desde + this.tamanioPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.tiempos.length / this.tamanioPagina);
  }

  irAPagina(p: number): void {
    if (p >= 0 && p < this.totalPaginas) {
      this.paginaActual = p;
    }
  }

  /** El promedio de espera, que es el número que resume la tabla entera. */
  get promedioDias(): number {
    const conDato = this.tiempos.filter(t => t.diasEspera != null);
    if (!conDato.length) {
      return 0;
    }
    const suma = conDato.reduce((acc, t) => acc + (t.diasEspera ?? 0), 0);
    return Math.round((suma / conDato.length) * 10) / 10;
  }

  /** El que más esperó. Es el caso que la gente quiere ver primero. */
  get peorEspera(): TiempoComprobante | undefined {
    return this.tiempos.reduce<TiempoComprobante | undefined>(
      (peor, t) => (!peor || (t.diasEspera ?? 0) > (peor.diasEspera ?? 0)) ? t : peor,
      undefined);
  }

  /** Verde hasta 3 días, ámbar hasta 10, rojo más allá. */
  colorDeEspera(dias?: number): string {
    if (dias == null) { return ''; }
    if (dias <= 3) { return 'espera-ok'; }
    if (dias <= 10) { return 'espera-media'; }
    return 'espera-alta';
  }

  // ------------------------------------------------------------ uso

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

      // Null y no cero cuando contabilidad todavía no revisó nada: 0% diría
      // "no hay observaciones", que es lo contrario de "nadie miró".
      porcentajeObservadas: obs && obs.rendicionesRevisadas > 0
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

  // ------------------------------------------------------------ descarga

  /**
   * Baja la tabla que se está viendo como CSV.
   *
   * Con punto y coma y BOM porque el Excel en español abre así sin pedir
   * nada; con coma parte todo en una sola columna y el usuario termina
   * pegando a mano.
   */
  descargar(): void {
    let nombre = '';
    let filas: string[][] = [];

    if (this.vista === 'usuarios') {
      nombre = 'rendiciones_por_usuario';
      filas = [['Usuario', 'Usuario del sistema', 'Rendiciones', 'Comprobantes',
                'Importe S/', 'Comprob. por rendicion', 'Primer envio', 'Ultimo envio']];
      for (const u of this.usuarios) {
        filas.push([u.usuario, u.username ?? '', String(u.rendiciones), String(u.comprobantes),
                    String(u.importeSoles ?? 0), String(u.comprobantesPorRendicion ?? 0),
                    u.primerEnvio ?? '', u.ultimoEnvio ?? '']);
      }
    } else if (this.vista === 'tiempos') {
      nombre = 'tiempo_carga_a_envio';
      filas = [['Orden', 'Item OP', 'Comprobante', 'Tipo', 'Importe S/',
                'Cargado', 'Enviado', 'Horas', 'Dias', 'Cargado por']];
      for (const t of this.tiempos) {
        filas.push([t.numOrden, t.numItemOp ?? '', t.comprobante, t.codDocumento ?? '',
                    String(t.impSoles ?? 0), t.fecCarga ?? '', t.fecEnvio ?? '',
                    String(t.horasEspera ?? ''), String(t.diasEspera ?? ''),
                    t.usuarioCarga ?? '']);
      }
    } else if (this.vista === 'centros') {
      nombre = 'gasto_por_centro_de_costos';
      filas = [['Codigo', 'Centro de costos', 'Rendiciones', 'Comprobantes', 'Importe S/', '% del total']];
      for (const c of this.centros) {
        filas.push([c.codCCostos, c.desCCostos, String(c.rendiciones), String(c.comprobantes),
                    String(c.importeSoles ?? 0), String(c.porcentaje ?? 0)]);
      }
    } else if (this.vista === 'uso') {
      nombre = 'uso_de_regina';
      filas = [['Usuario', 'Usuario del sistema', 'Correo', 'Nivel', 'Rendiciones',
                'Comprobantes', 'Ultima rendicion']];
      for (const u of this.uso) {
        filas.push([u.usuario, u.username ?? '', u.email ?? '', this.etiquetaNivel(u.nivel),
                    String(u.rendiciones), String(u.comprobantes), u.ultimaRendicion ?? '']);
      }
    } else if (this.vista === 'observaciones') {
      nombre = 'motivos_de_observacion';
      filas = [['Motivo', 'Veces', 'Importe S/', '% de las observaciones']];
      for (const m of this.observaciones?.motivos ?? []) {
        filas.push([m.desMotivo, String(m.veces), String(m.importe ?? 0), String(m.porcentaje ?? 0)]);
      }
    } else {
      return;
    }

    const csv = filas
      .map(f => f.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
