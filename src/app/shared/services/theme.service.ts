import { Injectable } from '@angular/core';

export type ThemeKey = 'AZUL' | 'VERDE' | 'ROJO' | 'NARANJA' | 'VIOLETA' | 'GRIS';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'theme';

  getStoredTheme(): ThemeKey | null {
    return localStorage.getItem(this.storageKey) as ThemeKey | null;
  }

  applyTheme(theme: ThemeKey): void {
    const root = document.documentElement;

    switch (theme) {
      case 'AZUL':
        root.style.setProperty('--primary-color', '#0063A7');
        root.style.setProperty('--primary-color-hover', '#004f86');
        break;

      case 'VERDE':
        root.style.setProperty('--primary-color', '#198754');
        root.style.setProperty('--primary-color-hover', '#1b5e20');
        break;

      case 'NARANJA':
        root.style.setProperty('--primary-color', '#d9a121');
        root.style.setProperty('--primary-color-hover', '#8e0000');
        break;

      case 'VIOLETA':
        root.style.setProperty('--primary-color', '#b9a8ff');
        root.style.setProperty('--primary-color-hover', '#8e0000');
        break;

      case 'GRIS':
        root.style.setProperty('--primary-color', '#939598');
        root.style.setProperty('--primary-color-hover', '#8e0000');
        break;

      case 'ROJO':
        root.style.setProperty('--primary-color', '#e14946');
        root.style.setProperty('--primary-color-hover', '#8e0000');
        break;
    }
  }

  setTheme(theme: ThemeKey): void {
    localStorage.setItem(this.storageKey, theme);
    this.applyTheme(theme);
  }
}
