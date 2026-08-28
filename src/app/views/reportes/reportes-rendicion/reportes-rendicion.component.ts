import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { ReporteRendicionService } from '../../../services/reporte-rendicion.service';
import {
  FiltroReporte,
  ObservacionesResumen,
  RendicionPorCentroCosto,
  RendicionPorUsuario,
  ResumenRendiciones,
  TiempoComprobante,
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
  observaciones?: ObservacionesResumen;
  uso: UsoRegina[] = [];

  readonly estados = [
    { valor: '',           etiqueta: 'Todos' },
    { valor: 'RENDIDA',    etiqueta: 'Enviadas a contabilidad' },
    { valor: 'ABIERTA',    etiqueta: 'En preparación' },
    { valor: 'RECHAZADA',  etiqueta: 'Rechazadas' },
  ];

  buscoAlgunaVez = false;
  mensajeError = '';

  /** Paginado de la tabla de tiempos, que es la única que puede ser larga. */
  paginaActual = 0;
  readonly tamanioPagina = 15;

  constructor(
    private servicio: ReporteRendicionService,
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
    this.buscar();
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
        this.servicio.tiempos(this.codEmpresa, this.codSucursal, this.filtro)
          .subscribe({
            next: r => { this.tiempos = r ?? []; this.paginaActual = 0; listo(); },
            error: fallo
          });
    }
  }

  limpiar(): void {
    this.filtro = new FiltroReporte();
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
