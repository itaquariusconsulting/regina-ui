import { Injectable } from '@angular/core';

export type ThemeKey = 'AZUL' | 'VERDE' | 'ROJO' | 'NARANJA' | 'VIOLETA' | 'GRIS';

/**
 * Preferencia de color del usuario.
 *
 * RETIRADO (setiembre 2026). RENDIX es una marca, no una paleta a
 * elegir: el color lo define styles/_rendix.scss y es uno solo.
 *
 * Por que el servicio sigue existiendo y no se borro:
 *
 *   1. La preferencia esta guardada en la base, por usuario, y el
 *      backend la sigue devolviendo. El login la lee al entrar.
 *   2. Varios componentes lo inyectan. Borrarlo obliga a tocarlos
 *      todos, que es justo el tipo de cambio colateral que rompe
 *      cosas en una tanda de estilos.
 *
 * Entonces se conserva la firma y se apaga el efecto: applyTheme ya
 * no pinta nada. Guardar la preferencia sigue funcionando y no
 * molesta a nadie.
 *
 * Esto es lo que impide que un usuario que dejo elegido VERDE entre
 * y vea el logo RENDIX sobre una barra verde.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'theme';

  getStoredTheme(): ThemeKey | null {
    return sessionStorage.getItem(this.storageKey) as ThemeKey | null;
  }

  /**
   * Ya no cambia ningun color.
   *
   * Antes escribia --primary-color y --sidebar-color directamente
   * sobre :root con setProperty, o sea con estilo en linea, que le
   * gana a cualquier hoja de estilos. Por eso pisaba la identidad de
   * la marca y no habia forma de defenderse desde el CSS.
   */
  applyTheme(_theme: ThemeKey): void {
    /* intencionalmente vacio */
  }

  setTheme(theme: ThemeKey): void {
    sessionStorage.setItem(this.storageKey, theme);
    this.applyTheme(theme);
  }
}
