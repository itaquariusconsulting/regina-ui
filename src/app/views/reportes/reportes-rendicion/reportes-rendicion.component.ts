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
  RendicionPorUsuario,
  ResumenRendiciones,
  TiempoComprobante
} from '../../../models/reporte-rendicion';

type Vista = 'resumen' | 'usuarios' | 'tiempos';

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
  tiempos: TiempoComprobante[] = [];

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
    if (pedida === 'usuarios' || pedida === 'tiempos' || pedida === 'resumen') {
      this.vista = pedida;
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

    if (this.vista === 'resumen') {
      this.servicio.resumen(this.codEmpresa, this.codSucursal, this.filtro)
        .subscribe({ next: r => { this.resumen = r; listo(); }, error: fallo });

    } else if (this.vista === 'usuarios') {
      this.servicio.porUsuario(this.codEmpresa, this.codSucursal, this.filtro)
        .subscribe({ next: r => { this.usuarios = r ?? []; listo(); }, error: fallo });

    } else {
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
