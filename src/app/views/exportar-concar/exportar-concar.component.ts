import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { ConcarService } from '../../services/concar.service';
import { OpRendidaService } from '../../services/op-rendida.service';
import { FiltroOpRendida, OpRendida } from '../../models/op-rendida';
import { LlaveMesConcar, ObservacionConcar, RevisionMesConcar } from '../../models/concar';
import { Response } from '../../models/response';

/**
 * El archivo del mes para CONCAR.
 *
 * Contabilidad lo pidió por mes y no por orden: un solo Excel con todos los
 * asientos del periodo, cada uno con su número de comprobante corriendo.
 *
 * Las OP no se juntan solas. El usuario marca cuáles van, para poder dejar
 * afuera la que todavía discute y rearmar el archivo después sin esperar a
 * que se resuelva.
 *
 * Dos pasos, y la diferencia importa: **revisar** no consume numeración y se
 * puede repetir; **descargar** reserva los correlativos, así que se habilita
 * solo cuando la revisión pasó.
 */
@Component({
  selector: 'app-exportar-concar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exportar-concar.component.html',
  styleUrls: ['./exportar-concar.component.scss']
})
export class ExportarConcarComponent implements OnInit {

  codEmpresa: string = sessionStorage.getItem('codempresa') ?? '';
  codSucursal: string = sessionStorage.getItem('codsucursal') ?? '';

  anio: string = sessionStorage.getItem('periodo_year') ?? String(new Date().getFullYear());
  mes: string = sessionStorage.getItem('periodo_month') ?? this.dosDigitos(new Date().getMonth() + 1);

  filtro: FiltroOpRendida = new FiltroOpRendida();

  ordenes: OpRendida[] = [];
  /** Las OP marcadas, por numOrden. */
  marcadas = new Set<string>();

  /** Iniciales de quien exporta. Arrancan del usuario logueado. */
  iniciales = '';
  /** Si se escribe, manda sobre el patrón del servidor. */
  numDocumento = '';

  revision: RevisionMesConcar | null = null;

  buscando = false;
  revisando = false;
  descargando = false;

  constructor(private concar: ConcarService,
              private opRendida: OpRendidaService) {}

  ngOnInit(): void {
    this.iniciales = this.inicialesDe(sessionStorage.getItem('username')
                                   ?? sessionStorage.getItem('user') ?? '');
    this.buscar();
  }

  /* ----------------------------------------------------------- la lista */

  buscar(): void {
    this.buscando = true;
    this.revision = null;

    const f: FiltroOpRendida = { ...this.filtro, anio: this.anio, mes: this.mes };

    this.opRendida.buscar(this.codEmpresa, this.codSucursal, f).subscribe({
      next: (lista) => {
        this.ordenes = lista ?? [];
        /* Se descartan las marcas de OP que ya no están en la lista: de otro
           modo una búsqueda nueva dejaría marcadas órdenes invisibles y el
           archivo saldría con asientos que el usuario no ve. */
        const visibles = new Set(this.ordenes.map(o => o.numOrden ?? ''));
        this.marcadas = new Set([...this.marcadas].filter(n => visibles.has(n)));
        this.buscando = false;
      },
      error: () => {
        this.buscando = false;
        Swal.fire('No se pudo buscar', 'Revise la conexión e intente de nuevo.', 'error');
      }
    });
  }

  alternar(o: OpRendida): void {
    const n = o.numOrden ?? '';
    if (!n) { return; }
    if (this.marcadas.has(n)) { this.marcadas.delete(n); } else { this.marcadas.add(n); }
    /* La revisión queda vieja en cuanto cambia la selección. */
    this.revision = null;
  }

  marcada(o: OpRendida): boolean {
    return this.marcadas.has(o.numOrden ?? '');
  }

  marcarTodas(valor: boolean): void {
    this.marcadas = valor
      ? new Set(this.ordenes.map(o => o.numOrden ?? '').filter(n => !!n))
      : new Set<string>();
    this.revision = null;
  }

  get todasMarcadas(): boolean {
    return this.ordenes.length > 0 && this.marcadas.size === this.ordenes.length;
  }

  get totalMarcado(): number {
    return this.ordenes
      .filter(o => this.marcada(o))
      .reduce((a, o) => a + (o.impRendidoSoles ?? 0), 0);
  }

  /* -------------------------------------------------- revisar y bajar */

  revisar(): void {
    if (this.marcadas.size === 0) {
      Swal.fire('Falta marcar', 'Elija al menos una orden de pago.', 'info');
      return;
    }

    this.revisando = true;

    this.concar.revisarMes(this.llave()).subscribe({
      next: (r: Response) => {
        this.revision = (r?.resultado ?? null) as RevisionMesConcar | null;
        this.revisando = false;
      },
      error: (e) => {
        this.revisando = false;
        this.revision = null;
        Swal.fire('No se pudo revisar', e?.error?.mensaje ?? 'Error inesperado.', 'error');
      }
    });
  }

  descargar(): void {
    if (!this.revision?.puedeExportar) { return; }

    this.descargando = true;

    this.concar.exportarMes(this.llave()).subscribe({
      next: (res) => {
        this.concar.descargarMes(res, this.anio, this.mes);
        this.descargando = false;
        Swal.fire('Archivo generado',
                  'Se reservaron los números de comprobante de las órdenes incluidas.',
                  'success');
      },
      error: async (e) => {
        this.descargando = false;
        /* El 422 trae las observaciones en el cuerpo, que llega como Blob
           porque la llamada pidió blob. Sin leerlo, el usuario vería un error
           genérico en vez de la lista de qué está mal. */
        const r = await this.concar.leerError(e);
        if (r) {
          this.revisar();
          Swal.fire('El archivo no se generó', r.mensaje ?? 'Hay observaciones.', 'warning');
        } else {
          Swal.fire('No se pudo generar', 'Error inesperado al crear el archivo.', 'error');
        }
      }
    });
  }

  /* ------------------------------------------------------------ apoyo */

  /** Los reparos de una orden, para pintarlos bajo su fila. */
  observacionesDe(numOrden: string): ObservacionConcar[] {
    return this.revision?.porOrden
      ?.find(r => r.numOrden === numOrden)?.observaciones ?? [];
  }

  erroresDe(numOrden: string): number {
    return this.observacionesDe(numOrden).filter(o => o.nivel === 'ERROR').length;
  }

  avisosDe(numOrden: string): number {
    return this.observacionesDe(numOrden).filter(o => o.nivel === 'AVISO').length;
  }

  comprobanteDe(numOrden: string): string {
    return this.revision?.porOrden?.find(r => r.numOrden === numOrden)?.numComprobante ?? '';
  }

  get totalErrores(): number {
    return (this.revision?.porOrden ?? [])
      .reduce((a, r) => a + r.observaciones.filter(o => o.nivel === 'ERROR').length, 0);
  }

  private llave(): LlaveMesConcar {
    return {
      codEmpresa: this.codEmpresa,
      codSucursal: this.codSucursal,
      anioPeriodo: this.anio,
      codPeriodo: this.mes,
      ordenes: [...this.marcadas],
      numDocumento: this.numDocumento?.trim() || undefined,
      iniciales: this.iniciales?.trim() || undefined
    };
  }

  /**
   * "CARLOS JARA" -> "CJ".
   *
   * Es la costumbre que describió contabilidad para el número del documento:
   * el mes y las siglas de la persona encargada. Se puede corregir a mano.
   */
  private inicialesDe(nombre: string): string {
    return nombre
      .split(/[\s.,]+/)
      .filter(p => p.length > 0)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');
  }

  private dosDigitos(n: number): string {
    return n < 10 ? `0${n}` : String(n);
  }
}
