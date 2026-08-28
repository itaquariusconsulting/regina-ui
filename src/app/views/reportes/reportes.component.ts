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
  /** Abre una pantalla. */
  action?: () => void;
  /**
   * Genera un PDF.
   *
   * Separado de `action` para no atar cada tarjeta a su posición en el
   * arreglo: antes cada una llamaba a runReport con su índice a mano, así
   * que agregar o quitar una tarjeta corría los índices y el spinner
   * aparecía sobre la tarjeta equivocada, sin error y sin que se note.
   */
  generar?: () => Observable<boolean>;
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

  reportes: ReporteItem[] = [
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
      generar: () => this.reportsService.reportePlanillasMovilidad()
    },
    {
      emoji: '📈',
      title: 'Reporte de Cumplimiento',
      description: 'Análisis de % de rendición vs importes por estado y por beneficiario.',
      color: '#8b5cf6',
      available: true,
      generar: () => this.reportsService.reporteCumplimiento()
    },
    {
      emoji: '📋',
      title: 'Gasto por Centro de Costos',
      description: 'Cuánto se entregó y cuánto volvió rendido en cada centro, con lo que queda pendiente.',
      color: '#f59e0b',
      available: true,
      action: () => this.router.navigate(['/centro-costos'])
    },
    {
      emoji: '👥',
      title: 'Reporte por Beneficiario',
      description: 'Histórico de OPs y cumplimiento agrupado por usuario beneficiario.',
      color: '#06b6d4',
      available: true,
      generar: () => this.reportsService.reporteBeneficiarios()
    },
    {
      emoji: '⚠️',
      title: 'Reporte de Vencimientos',
      description: 'OPs con el plazo de rendición vencido o por vencer, con filtros por fecha y persona.',
      color: '#dc2626',
      available: true,
      // Abre la pantalla en vez de bajar el PDF de una: el PDF quedo como
      // un boton adentro, para cuando hay que mandarlo o archivarlo.
      action: () => this.router.navigate(['/vencimientos'])
    },
    {
      emoji: '🧾',
      title: 'Reporte SUNAT',
      description: 'Comprobantes consolidados con detalle por proveedor (RUC) e importes.',
      color: '#7c3aed',
      available: true,
      generar: () => this.reportsService.reporteSunat()
    },

    // Los tres de la antesala. No generan PDF: abren una pantalla con
    // filtros, porque son numeros que se miran y se cruzan, no un documento
    // que se archiva.
    {
      emoji: '📥',
      title: 'Rendiciones Recibidas',
      description: 'Cuántas rendiciones llegaron a contabilidad, con comprobantes e importes.',
      color: '#059669',
      available: true,
      action: () => this.router.navigate(['/reportes-rendicion'], { queryParams: { vista: 'resumen' } })
    },
    {
      emoji: '🙋',
      title: 'Rendiciones por Usuario',
      description: 'Quién envió cuánto: rendiciones, comprobantes e importe por persona.',
      color: '#0ea5e9',
      available: true,
      action: () => this.router.navigate(['/reportes-rendicion'], { queryParams: { vista: 'usuarios' } })
    },
    {
      emoji: '⏱️',
      title: 'Tiempo de Carga a Envío',
      description: 'Comprobante por comprobante, cuánto pasó desde que se cargó hasta que salió.',
      color: '#e11d48',
      available: true,
      action: () => this.router.navigate(['/reportes-rendicion'], { queryParams: { vista: 'tiempos' } })
    },
    {
      emoji: '🏢',
      title: 'Centro de Costos — Detalle',
      description: 'El gasto rendido repartido por el centro de cada comprobante, desde REGINA.',
      color: '#7c3aed',
      available: true,
      action: () => this.router.navigate(['/reportes-rendicion'], { queryParams: { vista: 'centros' } })
    },
    {
      emoji: '🚩',
      title: 'Observaciones y Motivos',
      description: 'Cuántas rendiciones vienen con observaciones y por qué motivos.',
      color: '#f97316',
      available: true,
      action: () => this.router.navigate(['/reportes-rendicion'], { queryParams: { vista: 'observaciones' } })
    },
    {
      emoji: '📉',
      title: 'Uso de REGINA',
      description: 'Quién lo está usando y quién no, con nivel de uso y última rendición.',
      color: '#0891b2',
      available: true,
      action: () => this.router.navigate(['/reportes-rendicion'], { queryParams: { vista: 'uso' } })
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
    if (!rep.available || rep.generating) {
      return;
    }
    if (rep.generar) {
      this.generarPdf(rep);
    } else if (rep.action) {
      rep.action();
    }
  }

  /**
   * Genera el PDF de una tarjeta.
   *
   * Recibe la tarjeta, no su posición: el spinner se prende sobre el objeto
   * que el usuario tocó, y agregar o quitar tarjetas deja de poder
   * desalinearlo.
   */
  private generarPdf(rep: ReporteItem): void {
    rep.generating = true;
    this.loadingService.show();

    const terminar = () => {
      rep.generating = false;
      this.loadingService.hide();
    };

    rep.generar!().subscribe({ next: terminar, error: terminar });
  }
}
