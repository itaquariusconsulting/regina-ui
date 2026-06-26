import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { OrdenPagoFilterIA } from './regina-ia.service';

/**
 * Servicio reactivo que transporta los filtros parseados por el chat de
 * Regina IA hacia las pantallas que los consumen (list-orden-pago,
 * list-usuarios, etc.).
 *
 * Por qué un servicio y NO `router.navigate({state: ...})`:
 *
 *   Cuando el usuario ya está en `/list-orders` y le pide al chat otra
 *   búsqueda, Angular Router NO re-emite `NavigationEnd` porque la URL
 *   no cambia. Eso provoca que el componente list-orden-pago no
 *   se re-inicialice y los nuevos filtros se pierdan.
 *
 *   Con un BehaviorSubject, cada vez que el chat detecta una intención
 *   de "ordenes" emite los filtros aquí, y la pantalla los aplica
 *   inmediatamente — sin depender de re-navegación.
 *
 * Uso:
 *
 *   Emisor (default-layout, después del subscribe del chat):
 *     this.chatFiltrosService.emitirFiltrosOrdenes(res.filtros);
 *
 *   Consumidor (list-orden-pago, en ngOnInit):
 *     this.chatFiltrosService.filtrosOrdenes$.subscribe(filtros => {
 *       if (filtros) this.aplicarFiltrosIA(filtros);
 *     });
 */
@Injectable({ providedIn: 'root' })
export class ChatFiltrosService {

  /**
   * BehaviorSubject del último filtro emitido. Comienza en `null` para
   * que los nuevos suscriptores no apliquen un filtro vacío sin querer.
   */
  private filtrosOrdenesSubject = new BehaviorSubject<OrdenPagoFilterIA | null>(null);

  /**
   * Observable público para que las pantallas se suscriban a los
   * cambios de filtros del chat.
   */
  readonly filtrosOrdenes$: Observable<OrdenPagoFilterIA | null> = this.filtrosOrdenesSubject.asObservable();

  /** Emite un nuevo set de filtros para órdenes de pago. */
  emitirFiltrosOrdenes(filtros: OrdenPagoFilterIA | null | undefined): void {
    this.filtrosOrdenesSubject.next(filtros || null);
  }

  /** Limpia el último filtro emitido. Útil cuando se sale del listado. */
  limpiarFiltrosOrdenes(): void {
    this.filtrosOrdenesSubject.next(null);
  }

  /** Devuelve el último filtro emitido (snapshot sin suscribirse). */
  getUltimoFiltro(): OrdenPagoFilterIA | null {
    return this.filtrosOrdenesSubject.getValue();
  }
}
