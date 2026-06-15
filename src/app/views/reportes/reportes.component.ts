import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ReportsService } from '../../services/reports.service';
import { LoadingService } from '../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../components/loading-dancing-squares/loading-dancing-squares.component';

interface ReporteItem {
  emoji: string;
  title: string;
  description: string;
  color: string;
  available: boolean;
  generating?: boolean;
  action?: () => void;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, LoadingDancingSquaresComponent],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.scss'
})
export class ReportesComponent {

  isLoading$: Observable<boolean>;
  generandoIdx: number | null = null;

  reportes: ReporteItem[] = [
    {
      emoji: '📄',
      title: 'Reporte de Rendición',
      description: 'PDF profesional de rendición por orden de pago. Disponible en la lista de OPs (botón rojo).',
      color: '#ef4444',
      available: true,
      action: () => this.router.navigate(['/list-orders'])
    },
    {
      emoji: '📊',
      title: 'Dashboard Ejecutivo',
      description: 'Indicadores, KPIs y gráficos en tiempo real de tus órdenes de pago.',
      color: '#1976d2',
      available: true,
      action: () => this.router.navigate(['/dashboard'])
    },
    {
      emoji: '📑',
      title: 'Reporte de Planillas de Movilidad',
      description: 'Detalle consolidado de planillas y viajes asociados a cada orden de pago.',
      color: '#10b981',
      available: true,
      action: () => this.runReport(2, () => this.reportsService.reportePlanillasMovilidad())
    },
    {
      emoji: '📈',
      title: 'Reporte de Cumplimiento',
      description: 'Análisis de % de rendición vs importes por estado y por beneficiario.',
      color: '#8b5cf6',
      available: true,
      action: () => this.runReport(3, () => this.reportsService.reporteCumplimiento())
    },
    {
      emoji: '📋',
      title: 'Reporte por Centro de Costos',
      description: 'Distribución de gasto por centro de costos con cantidades, importes y % del total.',
      color: '#f59e0b',
      available: true,
      action: () => this.runReport(4, () => this.reportsService.reporteCentroCostos())
    },
    {
      emoji: '👥',
      title: 'Reporte por Beneficiario',
      description: 'Histórico de OPs y cumplimiento agrupado por usuario beneficiario.',
      color: '#06b6d4',
      available: true,
      action: () => this.runReport(5, () => this.reportsService.reporteBeneficiarios())
    },
    {
      emoji: '⚠️',
      title: 'Reporte de Vencimientos',
      description: 'Listado de OPs con fecha de rendición vencida o próxima a vencer (≤ 30 días).',
      color: '#dc2626',
      available: true,
      action: () => this.runReport(6, () => this.reportsService.reporteVencimientos())
    },
    {
      emoji: '🧾',
      title: 'Reporte SUNAT',
      description: 'Comprobantes consolidados con detalle por proveedor (RUC) e importes.',
      color: '#7c3aed',
      available: true,
      action: () => this.runReport(7, () => this.reportsService.reporteSunat())
    }
  ];

  constructor(
    private router: Router,
    private reportsService: ReportsService,
    private loadingService: LoadingService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ejecutar(rep: ReporteItem): void {
    if (rep.available && rep.action && !rep.generating) {
      rep.action();
    }
  }

  private runReport(idx: number, fn: () => Observable<boolean>): void {
    if (this.reportes[idx].generating) return;

    this.reportes[idx].generating = true;
    this.generandoIdx = idx;
    this.loadingService.show();

    fn().subscribe({
      next: () => {
        this.reportes[idx].generating = false;
        this.generandoIdx = null;
        this.loadingService.hide();
      },
      error: () => {
        this.reportes[idx].generating = false;
        this.generandoIdx = null;
        this.loadingService.hide();
      }
    });
  }
}
