import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, interval, fromEvent } from 'rxjs';
import { filter, first, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

/**
 * Detecta cuando hay una version nueva publicada y ofrece recargar.
 *
 * Por que hace falta:
 * el service worker de Angular descarga la version nueva en segundo plano,
 * pero NO la activa hasta que se cierran todas las pestanas de la aplicacion.
 * Como el usuario deja REGINA abierta durante dias, seguia viendo la version
 * anterior aunque el despliegue hubiera salido bien, y habia que limpiar el
 * service worker a mano desde las herramientas del navegador.
 *
 * No recargamos solos: el usuario puede estar a mitad de una rendicion. Se le
 * avisa y decide el. Si posterga, se le vuelve a preguntar mas adelante.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionAppService {

  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  /** Cada cuanto se pregunta al servidor si hay version nueva. */
  private static readonly INTERVALO_CHEQUEO_MS = 5 * 60 * 1000;

  /** Cuanto se espera antes de volver a ofrecer si el usuario posterga. */
  private static readonly REINTENTO_MS = 15 * 60 * 1000;

  private avisoAbierto = false;

  iniciar(): void {
    if (!this.swUpdate.isEnabled) {
      // En desarrollo el service worker esta apagado: no hay nada que vigilar.
      return;
    }

    this.escucharVersionNueva();
    this.programarChequeos();
    this.escucharEstadoIrrecuperable();
  }

  // ------------------------------------------------------------------
  private escucharVersionNueva(): void {
    this.swUpdate.versionUpdates
      .pipe(
        filter((evento): evento is VersionReadyEvent => evento.type === 'VERSION_READY')
      )
      .subscribe(() => this.ofrecerActualizacion());
  }

  private async ofrecerActualizacion(): Promise<void> {
    if (this.avisoAbierto) {
      return;
    }
    this.avisoAbierto = true;

    const respuesta = await Swal.fire({
      icon: 'info',
      title: 'Hay una version nueva',
      text: 'Se publico una actualizacion de REGINA. Conviene recargar para usarla.',
      showCancelButton: true,
      confirmButtonText: 'Actualizar ahora',
      cancelButtonText: 'Mas tarde',
      allowOutsideClick: false,
    });

    this.avisoAbierto = false;

    if (respuesta.isConfirmed) {
      await this.aplicar();
      return;
    }

    // Postergo: se vuelve a ofrecer mas adelante, sin insistir de inmediato.
    setTimeout(() => this.ofrecerActualizacion(), ActualizacionAppService.REINTENTO_MS);
  }

  private async aplicar(): Promise<void> {
    try {
      await this.swUpdate.activateUpdate();
    } catch (e) {
      console.error('[ActualizacionApp] no se pudo activar la version nueva', e);
    } finally {
      // Recarga completa: es lo unico que garantiza que se sirva el bundle nuevo.
      document.location.reload();
    }
  }

  // ------------------------------------------------------------------
  private programarChequeos(): void {
    // Se espera a que la aplicacion quede estable antes de empezar a
    // consultar: si no, el chequeo periodico impide que Angular considere
    // la app "estable" y el service worker nunca termina de registrarse.
    const estable$ = this.appRef.isStable.pipe(first(estable => estable === true));
    const cada$ = interval(ActualizacionAppService.INTERVALO_CHEQUEO_MS);

    concat(estable$, cada$).subscribe(() => this.chequear());

    // Y tambien al volver a la pestana, que es cuando el usuario retoma
    // el trabajo despues de un rato.
    fromEvent(document, 'visibilitychange')
      .pipe(map(() => document.visibilityState === 'visible'), filter(Boolean))
      .subscribe(() => this.chequear());
  }

  private chequear(): void {
    this.swUpdate.checkForUpdate()
      .catch(e => console.warn('[ActualizacionApp] fallo el chequeo de version', e));
  }

  // ------------------------------------------------------------------
  private escucharEstadoIrrecuperable(): void {
    // Pasa cuando la cache quedo corrupta o incompleta. Sin esto, la
    // aplicacion queda rota y el usuario no sabe que hacer.
    this.swUpdate.unrecoverable.subscribe(evento => {
      console.error('[ActualizacionApp] estado irrecuperable:', evento.reason);
      Swal.fire({
        icon: 'warning',
        title: 'Hay que recargar la pagina',
        text: 'La aplicacion quedo en un estado inconsistente y necesita recargarse.',
        confirmButtonText: 'Recargar',
        allowOutsideClick: false,
      }).then(() => document.location.reload());
    });
  }
}
