import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { OpRendidaService } from '../../../services/op-rendida.service';
import { FiltroOpRendida, OpRendida } from '../../../models/op-rendida';

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

  constructor(
    private location: Location,
    private loadingService: LoadingService,
    private opRendidaService: OpRendidaService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    // Arranca con el periodo en el que está trabajando el usuario, que es lo
    // que casi siempre quiere ver. Si no hay, se muestra todo.
    this.filtro.anio = sessionStorage.getItem('periodo_year') ?? '';
    this.filtro.mes = sessionStorage.getItem('periodo_month') ?? '';
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
