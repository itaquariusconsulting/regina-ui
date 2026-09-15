import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  Chart,
  registerables,
  ChartConfiguration,
  ChartData,
  ChartOptions,
  ChartType
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { OrdenPago } from '../../models/orden-pago';
import { OrdenPagoService } from '../../services/orden-pago.service';
import { WrapperRequestOrdenPago } from '../../models/wrappers/wrapper-request-orden-pago';
import { Response } from '../../models/response';
import { LoadingService } from '../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../components/loading-dancing-squares/loading-dancing-squares.component';

// Registrar Chart.js una sola vez
Chart.register(...registerables);

/**
 * Que hay detras del numero de cada tarjeta.
 *
 * Cada clave nombra el mismo subconjunto de ordenes que uso el calculo del
 * KPI. No es una etiqueta: es lo que el popup vuelve a filtrar para mostrar
 * el detalle, y por eso tiene que coincidir con calcularMetricas() al pie de
 * la letra. Si las dos se separan, el usuario ve un total que no cuadra con
 * la tarjeta que acaba de tocar, que es peor que no tener el detalle.
 */
type DetalleKpi =
  | 'todas' | 'EM' | 'PE' | 'LQ' | 'PR' | 'vencidas'
  | 'importeSoles' | 'importeDolares' | 'rendido' | 'porRendir'
  | 'cumplimiento' | 'promedio';

interface KpiCard {
  title: string;
  value: string;
  sub?: string;
  icon: string;
  color: string;
  /** Que ordenes mostrar cuando alguien toca la tarjeta. */
  detalle: DetalleKpi;
}

/** Una fila del popup de detalle. */
interface FilaDetalle {
  numOrden: string;
  fecOrden: Date | null;
  persona: string;
  glosa: string;
  moneda: string;
  estado: string;
  importe: number;
  rendido: number;
  porRendir: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BaseChartDirective,
    LoadingDancingSquaresComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {

  isLoading$: Observable<boolean>;

  /* ====== usuario / contexto ====== */
  isAdminUser: boolean = false;
  userName: string = '';

  /* ====== datos ====== */
  ordenes: OrdenPago[] = [];
  filteredOrdenes: OrdenPago[] = [];

  /* ====== filtros ====== */
  filterYear: number | 'all' = 'all';
  filterMonth: number | 'all' = 'all';
  filterEstado: string = 'all';
  filterMoneda: string = 'all';

  yearsAvailable: number[] = [];
  meses = [
    { v: 1, n: 'Ene' }, { v: 2, n: 'Feb' }, { v: 3, n: 'Mar' },
    { v: 4, n: 'Abr' }, { v: 5, n: 'May' }, { v: 6, n: 'Jun' },
    { v: 7, n: 'Jul' }, { v: 8, n: 'Ago' }, { v: 9, n: 'Sep' },
    { v: 10, n: 'Oct' }, { v: 11, n: 'Nov' }, { v: 12, n: 'Dic' }
  ];

  /* ====== KPIs ====== */
  kpis: KpiCard[] = [];

  /* ====== popup de detalle ====== */
  detalleAbierto = false;
  detalleTitulo = '';
  detalleSubtitulo = '';
  detalleColor = '#1976d2';
  /** Que columna de importe es la que suma este KPI; null en los de conteo. */
  detalleColumna: 'importe' | 'rendido' | 'porRendir' | null = null;
  detalleFilas: FilaDetalle[] = [];
  detalleBusqueda = '';
  /** El pie del popup: lo que dice la tarjeta, recalculado desde las filas. */
  detalleTotal = '';
  detalleTotalRotulo = '';

  /* métricas adicionales */
  cumplimientoPct = 0;
  vencidasCount = 0;
  vigentesCount = 0;
  promedioOrden = 0;
  maxOrden: OrdenPago | null = null;
  totalImporteSoles = 0;
  totalImporteDolares = 0;
  totalRendido = 0;

  /* ====== paleta ====== */
  palette = [
    '#1976d2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
    '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7'
  ];

  estadoColors: { [k: string]: string } = {
    'EM': '#f59e0b',
    'PE': '#3b82f6',
    'LQ': '#10b981',
    'PR': '#6b7280'
  };

  /* ============================================================
     CHARTS
  ============================================================ */

  // 1) DOUGHNUT - estados
  estadoChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  estadoChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} (${this.pct(ctx.parsed, this.estadoTotal)}%)` } }
    }
  };
  estadoTotal = 0;

  // 2) DOUGHNUT - moneda
  monedaChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  monedaChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
  };

  // 3) PIE - tipo de gasto (cantidad)
  tipoGastoChartData: ChartData<'pie'> = { labels: [], datasets: [] };
  tipoGastoChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } } }
  };

  // 4) BAR - importe mensual
  importeMensualData: ChartData<'bar'> = { labels: [], datasets: [] };
  importeMensualOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v) => this.fmt(Number(v)) } },
      x: { grid: { display: false } }
    }
  };

  // 5) BAR - cantidad mensual
  cantidadMensualData: ChartData<'bar'> = { labels: [], datasets: [] };
  cantidadMensualOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } }
  };

  // 6) LINE - importe vs rendido por mes
  lineImporteVsRendidoData: ChartData<'line'> = { labels: [], datasets: [] };
  lineImporteVsRendidoOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: { y: { beginAtZero: true, ticks: { callback: (v) => this.fmt(Number(v)) } } }
  };

  // 7) HORIZONTAL BAR - top auxiliares (admin only)
  topAuxiliaresData: ChartData<'bar'> = { labels: [], datasets: [] };
  topAuxiliaresOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, ticks: { callback: (v) => this.fmt(Number(v)) } } }
  };

  // 8) HORIZONTAL BAR - top tipo de gasto (importes)
  topTipoGastoData: ChartData<'bar'> = { labels: [], datasets: [] };
  topTipoGastoOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, ticks: { callback: (v) => this.fmt(Number(v)) } } }
  };

  // 9) HORIZONTAL BAR - top centro de costos
  topCentroCostosData: ChartData<'bar'> = { labels: [], datasets: [] };
  topCentroCostosOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, ticks: { callback: (v) => this.fmt(Number(v)) } } }
  };

  // 10) BAR - comparativa anual
  comparativaAnualData: ChartData<'bar'> = { labels: [], datasets: [] };
  comparativaAnualOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { callback: (v) => this.fmt(Number(v)) } } }
  };

  // 11) STACKED BAR - estado por mes
  estadoPorMesData: ChartData<'bar'> = { labels: [], datasets: [] };
  estadoPorMesOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
    }
  };

  // 12) DOUGHNUT - vencidas vs vigentes
  vencidasChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  vencidasChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
  };

  // 13) RADIAL CUMPLIMIENTO (gauge sintético con doughnut)
  cumplimientoChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  cumplimientoChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true, maintainAspectRatio: false, cutout: '78%',
    rotation: -90, circumference: 180,
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
  };

  constructor(
    private ordenPagoService: OrdenPagoService,
    private loadingService: LoadingService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    const userString = sessionStorage.getItem('user');
    if (!userString) return;

    try {
      const user = JSON.parse(userString);
      this.isAdminUser = !!user.userAdmin;
      this.userName = [user.userLastName, user.userMiddleName, user.userName]
        .filter(Boolean).join(' ').trim();

      const wrapper = new WrapperRequestOrdenPago();
      wrapper.codAuxiliar = user.codAuxiliar || '';
      wrapper.codEmpresa = user.codEmpresa || '';
      wrapper.codSucursal = user.codSucursal || '';
      wrapper.isAdmin = this.isAdminUser;

      this.cargarOrdenes(wrapper);
    } catch (e) {
      console.error('Error parsing user', e);
    }
  }

  private cargarOrdenes(wrapper: WrapperRequestOrdenPago): void {
    this.loadingService.show();
    this.ordenPagoService.getOrdenesPago(wrapper).subscribe({
      next: (res: Response) => {
        this.ordenes = res.resultado || [];

        const yearsSet = new Set<number>();
        this.ordenes.forEach(o => {
          const d = o.fecOrden ? new Date(o.fecOrden) : null;
          if (d && !isNaN(d.getTime())) yearsSet.add(d.getFullYear());
        });
        this.yearsAvailable = Array.from(yearsSet).sort((a, b) => b - a);
        if (this.yearsAvailable.length === 0) {
          this.yearsAvailable = [new Date().getFullYear()];
        }

        this.aplicarFiltros();
        this.loadingService.hide();
      },
      error: () => {
        this.loadingService.hide();
        this.ordenes = [];
        this.aplicarFiltros();
      }
    });
  }

  /* ====================================================== */
  /*  FILTROS                                                 */
  /* ====================================================== */
  aplicarFiltros(): void {
    this.filteredOrdenes = this.ordenes.filter(o => {
      const d = o.fecOrden ? new Date(o.fecOrden) : null;

      if (this.filterYear !== 'all') {
        if (!d || d.getFullYear() !== this.filterYear) return false;
      }
      if (this.filterMonth !== 'all') {
        if (!d || (d.getMonth() + 1) !== this.filterMonth) return false;
      }
      if (this.filterEstado !== 'all' && o.tipEstado !== this.filterEstado) return false;
      if (this.filterMoneda !== 'all' && o.codMoneda !== this.filterMoneda) return false;

      return true;
    });

    this.calcularMetricas();
  }

  resetFiltros(): void {
    this.filterYear = 'all';
    this.filterMonth = 'all';
    this.filterEstado = 'all';
    this.filterMoneda = 'all';
    this.aplicarFiltros();
  }

  recargar(): void {
    const userString = sessionStorage.getItem('user');
    if (!userString) return;
    try {
      const user = JSON.parse(userString);
      const wrapper = new WrapperRequestOrdenPago();
      wrapper.codAuxiliar = user.codAuxiliar || '';
      wrapper.codEmpresa = user.codEmpresa || '';
      wrapper.codSucursal = user.codSucursal || '';
      wrapper.isAdmin = this.isAdminUser;
      this.cargarOrdenes(wrapper);
    } catch { /* noop */ }
  }

  /* ====================================================== */
  /*  CÁLCULO DE MÉTRICAS Y CHARTS                            */
  /* ====================================================== */
  private calcularMetricas(): void {
    const ords = this.filteredOrdenes;

    /* ---------- KPIs ---------- */
    const totalOps = ords.length;
    const totalEM = ords.filter(o => o.tipEstado === 'EM').length;
    const totalPE = ords.filter(o => o.tipEstado === 'PE').length;
    const totalLQ = ords.filter(o => o.tipEstado === 'LQ').length;
    const totalPR = ords.filter(o => o.tipEstado === 'PR').length;

    this.totalImporteSoles = ords.filter(o => o.codMoneda === '01')
      .reduce((a, o) => a + (o.impOrdPago ?? 0), 0);
    this.totalImporteDolares = ords.filter(o => o.codMoneda === '02')
      .reduce((a, o) => a + (o.impOrdPago ?? 0), 0);

    const importeRendidoSoles = ords.reduce((a, o) => a + (o.impRendidoSoles ?? 0), 0);
    const importeRendidoDolares = ords.reduce((a, o) => a + (o.impRendidoDolares ?? 0), 0);
    this.totalRendido = importeRendidoSoles + importeRendidoDolares;

    const porRendirSoles = ords
      .filter(o => o.tipEstado === 'EM' || o.tipEstado === 'PE')
      .filter(o => o.codMoneda === '01')
      .reduce((a, o) => a + Math.max(0, (o.impOrdPago ?? 0) - (o.impRendidoSoles ?? 0)), 0);
    const porRendirDolares = ords
      .filter(o => o.tipEstado === 'EM' || o.tipEstado === 'PE')
      .filter(o => o.codMoneda === '02')
      .reduce((a, o) => a + Math.max(0, (o.impOrdPago ?? 0) - (o.impRendidoDolares ?? 0)), 0);

    const totalImporte = this.totalImporteSoles + this.totalImporteDolares;
    this.cumplimientoPct = totalImporte > 0
      ? Math.round((this.totalRendido / totalImporte) * 100)
      : 0;

    this.promedioOrden = totalOps > 0
      ? ords.reduce((a, o) => a + (o.impOrdPago ?? 0), 0) / totalOps
      : 0;

    this.maxOrden = ords.reduce<OrdenPago | null>((max, o) => {
      if (!max || (o.impOrdPago ?? 0) > (max.impOrdPago ?? 0)) return o;
      return max;
    }, null);

    const hoy = new Date();
    this.vencidasCount = ords.filter(o => {
      if (o.tipEstado === 'LQ' || o.tipEstado === 'PR') return false;
      if (!o.fecRendicion) return false;
      return new Date(o.fecRendicion).getTime() < hoy.getTime();
    }).length;
    this.vigentesCount = totalOps - this.vencidasCount;

    this.kpis = [
      { title: 'Total Órdenes',  value: totalOps.toString(),         sub: 'Filtrado actual',     icon: 'fas fa-file-invoice-dollar', color: '#1976d2', detalle: 'todas' },
      { title: 'Emitidas',       value: totalEM.toString(),          sub: 'Estado EM',           icon: 'fas fa-paper-plane',         color: '#f59e0b', detalle: 'EM' },
      { title: 'Pendientes',     value: totalPE.toString(),          sub: 'Por rendir',          icon: 'fas fa-hourglass-half',      color: '#3b82f6', detalle: 'PE' },
      { title: 'Liquidadas',     value: totalLQ.toString(),          sub: 'Cerradas',            icon: 'fas fa-check-double',        color: '#10b981', detalle: 'LQ' },
      { title: 'Procesadas',     value: totalPR.toString(),          sub: 'Asentadas',           icon: 'fas fa-archive',             color: '#6b7280', detalle: 'PR' },
      { title: 'Vencidas',       value: this.vencidasCount.toString(), sub: 'Fecha rendición pasada', icon: 'fas fa-exclamation-triangle', color: '#ef4444', detalle: 'vencidas' },
      { title: 'Importe S/',     value: this.fmt(this.totalImporteSoles),   sub: 'Soles totales',  icon: 'fas fa-coins',          color: '#1976d2', detalle: 'importeSoles' },
      { title: 'Importe US$',    value: this.fmt(this.totalImporteDolares), sub: 'Dólares totales', icon: 'fas fa-dollar-sign',    color: '#10b981', detalle: 'importeDolares' },
      { title: 'Rendido S/',     value: this.fmt(importeRendidoSoles),   sub: 'Sustentado',     icon: 'fas fa-receipt',         color: '#0d9488', detalle: 'rendido' },
      { title: 'Por Rendir S/',  value: this.fmt(porRendirSoles),        sub: 'En proceso',     icon: 'fas fa-tasks',           color: '#dc2626', detalle: 'porRendir' },
      { title: '% Cumplimiento', value: this.cumplimientoPct + '%',      sub: 'Rendido vs Importe', icon: 'fas fa-chart-pie',    color: '#8b5cf6', detalle: 'cumplimiento' },
      { title: 'Promedio OP',    value: this.fmt(this.promedioOrden),    sub: 'Ticket promedio', icon: 'fas fa-balance-scale',   color: '#06b6d4', detalle: 'promedio' }
    ];

    /* ---------- DOUGHNUT estado ---------- */
    this.estadoTotal = totalOps;
    this.estadoChartData = {
      labels: ['Emitida', 'Pendiente', 'Liquidada', 'Procesada'],
      datasets: [{
        data: [totalEM, totalPE, totalLQ, totalPR],
        backgroundColor: [
          this.estadoColors['EM'], this.estadoColors['PE'],
          this.estadoColors['LQ'], this.estadoColors['PR']
        ],
        borderWidth: 2, borderColor: '#fff'
      }]
    };

    /* ---------- DOUGHNUT moneda ---------- */
    const cantSoles = ords.filter(o => o.codMoneda === '01').length;
    const cantDolares = ords.filter(o => o.codMoneda === '02').length;
    const cantOtras = ords.filter(o => o.codMoneda !== '01' && o.codMoneda !== '02').length;
    this.monedaChartData = {
      labels: ['Soles (S/)', 'Dólares (US$)', 'Otras'],
      datasets: [{
        data: [cantSoles, cantDolares, cantOtras],
        backgroundColor: ['#1976d2', '#10b981', '#6b7280'],
        borderWidth: 2, borderColor: '#fff'
      }]
    };

    /* ---------- PIE tipo de gasto ---------- */
    const tipoGastoMap: { [k: string]: number } = {};
    ords.forEach(o => {
      const k = o.cdesTipoGasto || 'Sin clasificar';
      tipoGastoMap[k] = (tipoGastoMap[k] || 0) + 1;
    });
    const tgEntries = Object.entries(tipoGastoMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    this.tipoGastoChartData = {
      labels: tgEntries.map(e => e[0]),
      datasets: [{
        data: tgEntries.map(e => e[1]),
        backgroundColor: tgEntries.map((_, i) => this.palette[i % this.palette.length]),
        borderWidth: 2, borderColor: '#fff'
      }]
    };

    /* ---------- BARS importe / cantidad mensual ---------- */
    const refYear = (this.filterYear !== 'all') ? this.filterYear : (this.yearsAvailable[0] || new Date().getFullYear());
    const importeMes: number[] = new Array(12).fill(0);
    const cantidadMes: number[] = new Array(12).fill(0);

    // estado por mes (stacked)
    const emMes = new Array(12).fill(0);
    const peMes = new Array(12).fill(0);
    const lqMes = new Array(12).fill(0);
    const prMes = new Array(12).fill(0);

    this.ordenes.forEach(o => {
      const d = o.fecOrden ? new Date(o.fecOrden) : null;
      if (!d || isNaN(d.getTime())) return;
      if (d.getFullYear() !== refYear) return;
      const m = d.getMonth();
      importeMes[m] += (o.impOrdPago ?? 0);
      cantidadMes[m] += 1;
      switch (o.tipEstado) {
        case 'EM': emMes[m]++; break;
        case 'PE': peMes[m]++; break;
        case 'LQ': lqMes[m]++; break;
        case 'PR': prMes[m]++; break;
      }
    });

    this.importeMensualData = {
      labels: this.meses.map(m => m.n),
      datasets: [{
        data: importeMes,
        backgroundColor: '#1976d2',
        borderRadius: 6, borderSkipped: false,
        label: 'Importe'
      }]
    };

    this.cantidadMensualData = {
      labels: this.meses.map(m => m.n),
      datasets: [{
        data: cantidadMes,
        backgroundColor: '#10b981',
        borderRadius: 6, borderSkipped: false,
        label: 'Cantidad'
      }]
    };

    this.estadoPorMesData = {
      labels: this.meses.map(m => m.n),
      datasets: [
        { data: emMes, label: 'Emitidas',   backgroundColor: this.estadoColors['EM'] },
        { data: peMes, label: 'Pendientes', backgroundColor: this.estadoColors['PE'] },
        { data: lqMes, label: 'Liquidadas', backgroundColor: this.estadoColors['LQ'] },
        { data: prMes, label: 'Procesadas', backgroundColor: this.estadoColors['PR'] }
      ]
    };

    /* ---------- TOP auxiliares (admin) ---------- */
    if (this.isAdminUser) {
      const auxMap: { [k: string]: number } = {};
      ords.forEach(o => {
        const k = o.cdesAuxiliar || o.codAuxiliar || 'Sin asignar';
        auxMap[k] = (auxMap[k] || 0) + (o.impOrdPago ?? 0);
      });
      const top = Object.entries(auxMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
      this.topAuxiliaresData = {
        labels: top.map(t => this.short(t[0], 28)),
        datasets: [{
          data: top.map(t => t[1]),
          backgroundColor: top.map((_, i) => this.palette[i % this.palette.length]),
          borderRadius: 4
        }]
      };
    }

    /* ---------- TOP tipo de gasto (importe) ---------- */
    const tgMap: { [k: string]: number } = {};
    ords.forEach(o => {
      const k = o.cdesTipoGasto || 'Sin clasificar';
      tgMap[k] = (tgMap[k] || 0) + (o.impOrdPago ?? 0);
    });
    const tgTop = Object.entries(tgMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    this.topTipoGastoData = {
      labels: tgTop.map(t => this.short(t[0], 28)),
      datasets: [{
        data: tgTop.map(t => t[1]),
        backgroundColor: tgTop.map((_, i) => this.palette[(i + 2) % this.palette.length]),
        borderRadius: 4
      }]
    };

    /* ---------- TOP centro de costos ---------- */
    const ccMap: { [k: string]: number } = {};
    ords.forEach(o => {
      const k = o.codCCostos || 'Sin C.C.';
      ccMap[k] = (ccMap[k] || 0) + (o.impOrdPago ?? 0);
    });
    const ccTop = Object.entries(ccMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
    this.topCentroCostosData = {
      labels: ccTop.map(t => this.short(t[0], 24)),
      datasets: [{
        data: ccTop.map(t => t[1]),
        backgroundColor: ccTop.map((_, i) => this.palette[(i + 4) % this.palette.length]),
        borderRadius: 4
      }]
    };

    /* ---------- LINE - importe vs rendido (mensual) ---------- */
    const impSerie = new Array(12).fill(0);
    const renSerie = new Array(12).fill(0);
    this.ordenes.forEach(o => {
      const d = o.fecOrden ? new Date(o.fecOrden) : null;
      if (!d || isNaN(d.getTime())) return;
      if (d.getFullYear() !== refYear) return;
      const m = d.getMonth();
      impSerie[m] += (o.impOrdPago ?? 0);
      renSerie[m] += ((o.impRendidoSoles ?? 0) + (o.impRendidoDolares ?? 0));
    });

    this.lineImporteVsRendidoData = {
      labels: this.meses.map(m => m.n),
      datasets: [
        {
          data: impSerie, label: 'Importe Total', borderColor: '#1976d2',
          backgroundColor: 'rgba(25,118,210,0.18)', tension: 0.35, fill: true,
          pointRadius: 3, pointHoverRadius: 6, borderWidth: 2
        },
        {
          data: renSerie, label: 'Rendido', borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.18)', tension: 0.35, fill: true,
          pointRadius: 3, pointHoverRadius: 6, borderWidth: 2
        }
      ]
    };

    /* ---------- COMPARATIVA ANUAL ---------- */
    const anualMap: { [k: string]: number } = {};
    this.ordenes.forEach(o => {
      const d = o.fecOrden ? new Date(o.fecOrden) : null;
      if (!d || isNaN(d.getTime())) return;
      const y = d.getFullYear().toString();
      anualMap[y] = (anualMap[y] || 0) + (o.impOrdPago ?? 0);
    });
    const anualSorted = Object.entries(anualMap).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    this.comparativaAnualData = {
      labels: anualSorted.map(e => e[0]),
      datasets: [{
        data: anualSorted.map(e => e[1]),
        backgroundColor: anualSorted.map((_, i) => this.palette[i % this.palette.length]),
        borderRadius: 6,
        label: 'Importe acumulado'
      }]
    };

    /* ---------- DOUGHNUT vencidas vs vigentes ---------- */
    this.vencidasChartData = {
      labels: ['Vigentes', 'Vencidas'],
      datasets: [{
        data: [this.vigentesCount, this.vencidasCount],
        backgroundColor: ['#10b981', '#ef4444'],
        borderWidth: 2, borderColor: '#fff'
      }]
    };

    /* ---------- GAUGE % cumplimiento ---------- */
    this.cumplimientoChartData = {
      labels: ['Cumplido', 'Restante'],
      datasets: [{
        data: [this.cumplimientoPct, 100 - this.cumplimientoPct],
        backgroundColor: [this.gaugeColor(this.cumplimientoPct), '#e5e7eb'],
        borderWidth: 0
      }]
    };
  }

  /* ====================================================== */
  /*  POPUP DE DETALLE DE LAS TARJETAS                        */
  /* ====================================================== */

  /**
   * Abre el detalle de una tarjeta.
   *
   * <p>El popup no vuelve a consultar nada: el dashboard ya tiene todas las
   * ordenes en memoria y los KPI se calculan sobre filteredOrdenes, asi que
   * el detalle sale del mismo arreglo y respeta los cuatro filtros de arriba
   * sin hacer nada especial.
   *
   * <p>El total del pie se calcula DESDE las filas que se muestran, no se
   * copia del KPI. Asi, si alguna vez el filtro del detalle y el del calculo
   * se separan, el numero del popup cambia y se nota, en vez de mostrar un
   * total prestado que disimula el error.
   */
  abrirDetalle(kpi: KpiCard): void {

    const ords = this.ordenesDelKpi(kpi.detalle);

    this.detalleFilas = ords.map(o => this.aFila(o));
    this.detalleBusqueda = '';
    this.detalleTitulo = kpi.title;
    this.detalleColor = kpi.color;
    this.detalleColumna = this.columnaDelKpi(kpi.detalle);

    const n = this.detalleFilas.length;
    this.detalleSubtitulo = n === 1
      ? '1 orden de pago' + this.textoFiltros()
      : n.toLocaleString('es-PE') + ' órdenes de pago' + this.textoFiltros();

    this.calcularTotalDetalle(kpi.detalle);

    this.detalleAbierto = true;
  }

  cerrarDetalle(): void {
    this.detalleAbierto = false;
    this.detalleFilas = [];
    this.detalleBusqueda = '';
  }

  /**
   * Las ordenes que hay detras de cada numero.
   *
   * <p>Cada rama repite la condicion de calcularMetricas() tal cual. Se
   * repite a proposito y no se factoriza: son doce condiciones cortas y
   * leerlas al lado de su KPI es lo que permite comprobar que coinciden.
   */
  private ordenesDelKpi(detalle: DetalleKpi): OrdenPago[] {

    const ords = this.filteredOrdenes;

    switch (detalle) {

      case 'EM':
      case 'PE':
      case 'LQ':
      case 'PR':
        return ords.filter(o => o.tipEstado === detalle);

      case 'vencidas': {
        const hoy = new Date();
        return ords.filter(o => {
          if (o.tipEstado === 'LQ' || o.tipEstado === 'PR') return false;
          if (!o.fecRendicion) return false;
          return new Date(o.fecRendicion).getTime() < hoy.getTime();
        });
      }

      case 'importeSoles':
        return ords.filter(o => o.codMoneda === '01');

      case 'importeDolares':
        return ords.filter(o => o.codMoneda === '02');

      // Rendido S/ suma la columna de soles de TODAS las ordenes, no solo de
      // las que estan en soles. Se listan las que aportan algo: las de cero
      // no cambian el total y solo alargan la lista.
      case 'rendido':
        return ords.filter(o => (o.impRendidoSoles ?? 0) > 0);

      // Por Rendir S/ mira solo las emitidas y pendientes en soles, y nunca
      // baja de cero: una orden rendida de mas no descuenta de las demas.
      case 'porRendir':
        return ords
          .filter(o => o.tipEstado === 'EM' || o.tipEstado === 'PE')
          .filter(o => o.codMoneda === '01')
          .filter(o => Math.max(0, (o.impOrdPago ?? 0) - (o.impRendidoSoles ?? 0)) > 0);

      case 'todas':
      case 'cumplimiento':
      case 'promedio':
      default:
        return ords;
    }
  }

  /** La columna de importe que el popup resalta y ordena. */
  private columnaDelKpi(detalle: DetalleKpi): 'importe' | 'rendido' | 'porRendir' | null {
    if (detalle === 'rendido') return 'rendido';
    if (detalle === 'porRendir') return 'porRendir';
    if (detalle === 'importeSoles' || detalle === 'importeDolares'
     || detalle === 'promedio' || detalle === 'cumplimiento') return 'importe';
    return null;
  }

  private calcularTotalDetalle(detalle: DetalleKpi): void {

    const filas = this.detalleFilas;
    const suma = (f: (x: FilaDetalle) => number) => filas.reduce((a, x) => a + f(x), 0);

    switch (detalle) {

      case 'importeSoles':
        this.detalleTotalRotulo = 'Importe total';
        this.detalleTotal = 'S/ ' + this.fmtFull(suma(f => f.importe));
        break;

      case 'importeDolares':
        this.detalleTotalRotulo = 'Importe total';
        this.detalleTotal = 'US$ ' + this.fmtFull(suma(f => f.importe));
        break;

      case 'rendido':
        this.detalleTotalRotulo = 'Rendido total';
        this.detalleTotal = 'S/ ' + this.fmtFull(suma(f => f.rendido));
        break;

      case 'porRendir':
        this.detalleTotalRotulo = 'Por rendir total';
        this.detalleTotal = 'S/ ' + this.fmtFull(suma(f => f.porRendir));
        break;

      case 'promedio':
        this.detalleTotalRotulo = 'Ticket promedio';
        this.detalleTotal = filas.length > 0
          ? this.fmtFull(suma(f => f.importe) / filas.length)
          : '0.00';
        break;

      case 'cumplimiento':
        this.detalleTotalRotulo = 'Rendido sobre importe';
        this.detalleTotal = this.pct(suma(f => f.rendido), suma(f => f.importe)) + '%';
        break;

      default:
        this.detalleTotalRotulo = 'Órdenes';
        this.detalleTotal = filas.length.toLocaleString('es-PE');
        break;
    }
  }

  private aFila(o: OrdenPago): FilaDetalle {

    const importe = o.impOrdPago ?? 0;
    const esDolares = o.codMoneda === '02';
    const rendido = esDolares ? (o.impRendidoDolares ?? 0) : (o.impRendidoSoles ?? 0);

    return {
      numOrden: o.numOrden ?? '',
      fecOrden: o.fecOrden ? new Date(o.fecOrden) : null,
      persona: o.cdesAuxiliar ?? o.codAuxiliar ?? '',
      glosa: o.glosa ?? '',
      moneda: o.cdesMoneda ?? (esDolares ? 'US$' : 'S/'),
      estado: this.nombreEstado(o.tipEstado),
      importe,
      rendido,
      porRendir: Math.max(0, importe - rendido)
    };
  }

  nombreEstado(tip: string | undefined): string {
    switch (tip) {
      case 'EM': return 'Emitida';
      case 'PE': return 'Pendiente';
      case 'LQ': return 'Liquidada';
      case 'PR': return 'Procesada';
      default:   return tip ?? '';
    }
  }

  /** Que filtros de la pantalla estan puestos, para decirlo en el popup. */
  private textoFiltros(): string {
    const partes: string[] = [];
    if (this.filterYear !== 'all') partes.push(String(this.filterYear));
    if (this.filterMonth !== 'all') {
      const m = this.meses.find(x => x.v === this.filterMonth);
      if (m) partes.push(m.n);
    }
    if (this.filterEstado !== 'all') partes.push(this.nombreEstado(this.filterEstado));
    if (this.filterMoneda !== 'all') partes.push(this.filterMoneda === '01' ? 'Soles' : 'Dólares');
    return partes.length ? ' · ' + partes.join(' · ') : '';
  }

  /**
   * Las filas que se ven, ya con el buscador aplicado.
   *
   * <p>Busca en orden, persona y glosa a la vez: quien abre el detalle rara
   * vez sabe por cual de las tres va a buscar.
   */
  get detalleFilasVisibles(): FilaDetalle[] {
    const t = this.detalleBusqueda.trim().toLowerCase();
    if (!t) return this.detalleFilas;
    return this.detalleFilas.filter(f =>
      f.numOrden.toLowerCase().includes(t) ||
      f.persona.toLowerCase().includes(t) ||
      f.glosa.toLowerCase().includes(t));
  }

  /**
   * Baja el detalle a Excel.
   *
   * <p>Se arma el archivo aca y no en el servidor: el dashboard ya tiene los
   * datos y pedirle al backend algo que el navegador tiene al lado seria un
   * viaje de ida y vuelta por nada.
   *
   * <p>El formato es SpreadsheetML, la version XML que Excel abre sin
   * conversor. Se eligio porque el proyecto no tiene ninguna libreria de
   * Excel y un CSV perderia los tipos: las fechas saldrian como texto y los
   * importes se romperian con la coma decimal.
   */
  descargarDetalleExcel(): void {

    const filas = this.detalleFilasVisibles;
    if (!filas.length) return;

    const esc = (v: string) => (v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const celdaTexto = (v: string) =>
      `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
    const celdaNumero = (v: number) =>
      `<Cell ss:StyleID="num"><Data ss:Type="Number">${v}</Data></Cell>`;
    const celdaFecha = (d: Date | null) => d && !isNaN(d.getTime())
      ? `<Cell ss:StyleID="fec"><Data ss:Type="DateTime">${d.toISOString().slice(0, 19)}</Data></Cell>`
      : '<Cell><Data ss:Type="String"></Data></Cell>';

    const encabezados = ['Orden', 'Fecha', 'Persona', 'Glosa', 'Moneda',
                         'Estado', 'Importe', 'Rendido', 'Por rendir'];

    const cuerpo = filas.map(f =>
      '<Row>' +
      celdaTexto(f.numOrden) +
      celdaFecha(f.fecOrden) +
      celdaTexto(f.persona) +
      celdaTexto(f.glosa) +
      celdaTexto(f.moneda) +
      celdaTexto(f.estado) +
      celdaNumero(f.importe) +
      celdaNumero(f.rendido) +
      celdaNumero(f.porRendir) +
      '</Row>').join('');

    const xml =
      '<?xml version="1.0"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Styles>' +
      '<Style ss:ID="tit"><Font ss:Bold="1" ss:Color="#FFFFFF"/>' +
      '<Interior ss:Color="#1F4E79" ss:Pattern="Solid"/></Style>' +
      '<Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/></Style>' +
      '<Style ss:ID="fec"><NumberFormat ss:Format="dd/mm/yyyy"/></Style>' +
      '</Styles>' +
      '<Worksheet ss:Name="Detalle">' +
      '<Table>' +
      '<Row>' + encabezados.map(h =>
        `<Cell ss:StyleID="tit"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('') +
      '</Row>' +
      cuerpo +
      '</Table></Worksheet></Workbook>';

    const blob = new Blob(['﻿' + xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.nombreArchivo() + '.xls';
    a.click();
    URL.revokeObjectURL(url);
  }

  private nombreArchivo(): string {
    const limpio = this.detalleTitulo
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    return (limpio || 'detalle') + '_' + new Date().toISOString().slice(0, 10);
  }

  /* ====================================================== */
  /*  HELPERS                                                 */
  /* ====================================================== */
  fmt(n: number | undefined | null): string {
    const v = typeof n === 'number' ? n : 0;
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(v) >= 10_000) return (v / 1_000).toFixed(1) + 'K';
    return v.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  fmtFull(n: number | undefined | null): string {
    const v = typeof n === 'number' ? n : 0;
    return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  pct(part: number, total: number): string {
    return total > 0 ? ((part / total) * 100).toFixed(1) : '0';
  }

  short(s: string, max: number): string {
    if (!s) return '';
    return s.length > max ? s.substring(0, max - 1) + '…' : s;
  }

  gaugeColor(pct: number): string {
    if (pct >= 80) return '#10b981';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  }
}
