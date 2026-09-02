import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { PlanillaMovilidadReporteService } from '../../../services/planilla-movilidad-reporte.service';
import { PlanillaMovilidadReporte } from '../../../models/planilla-movilidad-reporte';

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
  /** Solo lo usa un admin; al resto el backend se lo ignora. */
  persona = '';

  constructor(
    private servicio: PlanillaMovilidadReporteService,
    private loadingService: LoadingService,
    private location: Location
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    this.rangoUltimoMes();
    this.buscar();
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
      .buscar(u.codEmpresa, u.codSucursal, this.desde, this.hasta, this.persona.trim())
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
        codSucursal: u.codSucursal || ''
      };
    } catch {
      return { codEmpresa: '', codSucursal: '' };
    }
  }
}
