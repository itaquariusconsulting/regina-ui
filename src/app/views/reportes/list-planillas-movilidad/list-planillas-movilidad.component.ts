import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { PlanillaMovilidadReporteService } from '../../../services/planilla-movilidad-reporte.service';
import { PlanillaMovilidadReporte } from '../../../models/planilla-movilidad-reporte';
import { OrdenPagoPlanillaMovilidadDetService }
  from '../../../services/orden-pago-planilla-movilidad-det.service';
import { PlanillaMovilidadPdfService, DatosPlanillaPdf }
  from '../../../services/planilla-movilidad-pdf.service';
import { MaestrosService } from '../../../services/maestros.service';
import { MaeUbigeo } from '../../../models/mae-ubigeo';
import { OrdenPagoCabPlanilla } from '../../../models/orden-pago-planilla-movilidad-cab';
import { OrdenPagoPlanillaMovilidadDet } from '../../../models/orden-pago-planilla-movilidad-det';
import { Response } from '../../../models/response';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/**
 * Las planillas de movilidad registradas en un rango.
 *
 * <p>La pregunta que contesta es "que planillas entraron entre estas dos
 * fechas". Por eso lista las planillas y no los viajes: el detalle de cada
 * una se ve entrando a la planilla.
 *
 * <p>QUIEN VE QUE lo decide el SERVIDOR, no esta pantalla. El backend saca el
 * usuario del token y lee de la base si es admin y a que auxiliar
 * corresponde. Un admin ve todas y puede acotar a una persona; el resto ve
 * solo las suyas, y el filtro de persona ni siquiera se le muestra. Si
 * alguien editara el sessionStorage para hacerse admin, la pantalla le
 * mostraria el filtro pero el backend seguiria devolviendole lo suyo.
 */
@Component({
  selector: 'app-list-planillas-movilidad',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './list-planillas-movilidad.component.html',
  styleUrls: ['./list-planillas-movilidad.component.scss']
})
export class ListPlanillasMovilidadComponent implements OnInit {

  isLoading$: Observable<boolean>;

  planillas: PlanillaMovilidadReporte[] = [];
  cuantas = 0;
  viajes = 0;
  gastado = 0;

  /** Lo dice el backend. Es la verdad, no lo que diga el sessionStorage. */
  admin = false;

  buscoAlgunaVez = false;
  huboError = false;

  // --- filtros
  desde = '';
  hasta = '';
  /**
   * Nombre o codigo de la persona. Solo lo usa un admin; al resto el backend
   * se lo ignora y le devuelve lo suyo.
   */
  persona = '';

  /** Para traducir el ubigeo del viaje en el formato impreso. */
  ubigeos: MaeUbigeo[] = [];

  /**
   * Tope de planillas que se imprimen de una sola vez.
   *
   * <p>Cada planilla es una llamada al servidor para traer sus viajes. Sin
   * tope, un rango de un ano dispara cientos de llamadas de golpe y el
   * navegador se queda colgado sin decir por que.
   */
  readonly MAX_IMPRESION = 60;

  imprimiendo = false;

  constructor(
    private servicio: PlanillaMovilidadReporteService,
    private planillaDetService: OrdenPagoPlanillaMovilidadDetService,
    private pdfService: PlanillaMovilidadPdfService,
    private maestrosService: MaestrosService,
    private loadingService: LoadingService,
    private location: Location
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    this.rangoUltimoMes();
    this.buscar();
    this.cargarUbigeos();
  }

  /**
   * Los ubigeos son para el formato impreso, no para la pantalla.
   *
   * <p>Si fallan, el PDF sale igual con el codigo en vez del distrito: es
   * peor no poder imprimir que imprimir un codigo.
   */
  private cargarUbigeos(): void {
    this.maestrosService.getUbigeos().subscribe({
      next: (res: Response) => { this.ubigeos = res?.resultado || []; },
      error: () => { this.ubigeos = []; }
    });
  }

  rangoUltimoMes(): void {
    const hoy = new Date();
    const mesAtras = new Date();
    mesAtras.setMonth(mesAtras.getMonth() - 1);
    this.desde = this.aIso(mesAtras);
    this.hasta = this.aIso(hoy);
  }

  verTodoElHistorial(): void {
    this.desde = '';
    this.hasta = '';
    this.buscar();
  }

  buscar(): void {
    const u = this.contextoUsuario();
    this.huboError = false;

    this.servicio
      .buscar(u.codEmpresa, u.codSucursal, this.desde, this.hasta,
              this.persona.trim(), u.userId)
      .subscribe({
        next: r => {
          this.planillas = r.planillas || [];
          this.cuantas = r.cuantas || 0;
          this.viajes = r.viajes || 0;
          this.gastado = r.gastado || 0;
          this.admin = !!r.admin;
          this.buscoAlgunaVez = true;
        },
        error: e => {
          // La pantalla se queda vacia y lo dice. Antes de esto, un fallo del
          // endpoint se veia igual que "no tenes planillas", que es la lectura
          // equivocada y la que hace que nadie reporte el problema.
          console.error('[planillas-movilidad] fallo la consulta:', e);
          this.planillas = [];
          this.cuantas = 0;
          this.viajes = 0;
          this.gastado = 0;
          this.buscoAlgunaVez = true;
          this.huboError = true;
        }
      });
  }

  limpiarPersona(): void {
    this.persona = '';
    this.buscar();
  }

  /** El promedio por planilla, para no hacer la cuenta a ojo. */
  get promedioPorPlanilla(): number {
    return this.cuantas ? this.gastado / this.cuantas : 0;
  }

  /** Lo gastado de una planilla, con el tope declarado como respaldo. */
  gastadoDe(p: PlanillaMovilidadReporte): number {
    return p.gastado ?? p.total ?? 0;
  }

  /** El estado de la planilla, en palabras. */
  estadoTexto(p: PlanillaMovilidadReporte): string {
    switch ((p.estado || '').trim().toUpperCase()) {
      case 'PE': return 'Abierta';
      case 'CE': return 'Cerrada';
      case 'AP': return 'En contabilidad';
      default:   return '—';
    }
  }

  /** Verde lo que ya viajó, ámbar lo que espera, gris lo que sigue abierto. */
  estadoClase(p: PlanillaMovilidadReporte): string {
    switch ((p.estado || '').trim().toUpperCase()) {
      case 'AP': return 'pm-est-ok';
      case 'CE': return 'pm-est-espera';
      default:   return 'pm-est-abierta';
    }
  }

  // ------------------------------------------------------- formato impreso

  /** Una planilla en el formato oficial, lista para firmar. */
  imprimir(p: PlanillaMovilidadReporte): void {
    this.imprimiendo = true;
    this.loadingService.show();

    this.viajesDe(p).subscribe(viajes => {
      this.pdfService.generar(this.datosPdf(p, viajes));
      this.loadingService.hide();
      this.imprimiendo = false;
    });
  }

  /**
   * Todas las planillas del rango en un solo PDF, una hoja por planilla.
   *
   * <p>Es lo que se manda a revisar: un archivo por planilla obliga a abrir
   * cincuenta adjuntos para firmar cincuenta papeles.
   *
   * <p>Las que fallen al traer sus viajes salen igual, con la grilla vacia
   * para llenar a mano: dejarlas fuera del PDF sin decir nada seria peor.
   */
  imprimirTodas(): void {
    const lista = this.planillas.slice(0, this.MAX_IMPRESION);
    if (!lista.length) {
      return;
    }

    this.imprimiendo = true;
    this.loadingService.show();

    forkJoin(lista.map(p => this.viajesDe(p))).subscribe(porPlanilla => {
      const datos: DatosPlanillaPdf[] = lista.map(
        (p, i) => this.datosPdf(p, porPlanilla[i]));

      this.pdfService.generarVarias(datos,
        `Planillas_Movilidad_${this.desde || 'inicio'}_${this.hasta || 'hoy'}.pdf`);

      this.loadingService.hide();
      this.imprimiendo = false;
    });
  }

  /** Cuantas quedarian fuera de la impresion masiva, si es que alguna. */
  get fueraDeImpresion(): number {
    return Math.max(this.planillas.length - this.MAX_IMPRESION, 0);
  }

  /** Los viajes de una planilla; lista vacia si no se pudieron traer. */
  private viajesDe(p: PlanillaMovilidadReporte) {
    const u = this.contextoUsuario();

    return this.planillaDetService.listarDetalle(
        p.codEmpresa || u.codEmpresa,
        p.codSucursal || u.codSucursal,
        p.anioPeriodo || '',
        p.codPeriodo || '',
        p.numOrden || '',
        p.codPlanilla || ''
      ).pipe(
        map((r: Response) => (r?.resultado || []) as OrdenPagoPlanillaMovilidadDet[]),
        catchError(() => of([] as OrdenPagoPlanillaMovilidadDet[]))
      );
  }

  /** Arma lo que el formato necesita a partir de la fila del reporte. */
  private datosPdf(p: PlanillaMovilidadReporte,
                   viajes: OrdenPagoPlanillaMovilidadDet[]): DatosPlanillaPdf {

    const cab = new OrdenPagoCabPlanilla();
    cab.codEmpresa = p.codEmpresa;
    cab.codSucursal = p.codSucursal;
    cab.anioPeriodo = p.anioPeriodo;
    cab.codPeriodo = p.codPeriodo;
    cab.numOrden = p.numOrden;
    cab.codPlanilla = p.codPlanilla;
    cab.fechaPlanilla = p.fechaPlanilla ? new Date(p.fechaPlanilla) : undefined;

    return {
      planilla: cab,
      viajes,
      nombreTrabajador: p.persona || '',
      ubigeo: (cod) => this.textoUbigeo(cod),
    };
  }

  private textoUbigeo(cod?: string | null): string {
    if (!cod) {
      return '';
    }
    const u = this.ubigeos.find(x => x.codUbigeo === cod);
    if (!u) {
      return cod;
    }
    return [u.desDepartamento, u.desProvincia, u.desDistrito].filter(Boolean).join(' - ');
  }

  descargarCsv(): void {
    const filas: string[][] = [[
      'Fecha', 'Orden', 'Planilla', 'Codigo persona', 'Persona', 'Viajes', 'Total S/'
    ]];

    for (const p of this.planillas) {
      filas.push([
        this.soloFecha(p.fechaPlanilla),
        p.numOrden || '', p.codPlanilla || '',
        p.codAuxiliar || '', p.persona || '',
        String(p.viajes ?? 0),
        Number(p.total ?? 0).toFixed(2)
      ]);
    }

    const csv = filas
      .map(f => f.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    // El BOM es lo que hace que Excel en Windows abra las tildes bien.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planillas_movilidad_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  volver(): void {
    this.location.back();
  }

  // ------------------------------------------------------------- helpers

  /** La fecha viene como ISO del backend; para el CSV alcanza el dia. */
  private soloFecha(v: string): string {
    return (v || '').slice(0, 10);
  }

  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private contextoUsuario() {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || '{}');
      return {
        codEmpresa: u.codEmpresa || '',
        codSucursal: u.codSucursal || '',
        // Quien pregunta. El backend lo usa para LEER de la base si es admin,
        // no para creerle: mandar otro id deja ver lo de esa persona, no mas.
        userId: u.userId as number | undefined
      };
    } catch {
      return { codEmpresa: '', codSucursal: '', userId: undefined };
    }
  }
}
