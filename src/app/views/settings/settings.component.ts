import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SettingsComponent implements OnInit {

  cards = [
    {
      title: 'Card Primary',
      colorBg: 'rgba(13,110,253,0.15)',
      colorBorder: 'rgba(13,110,253,0.6)'
    },
    {
      title: 'Card Success',
      colorBg: 'rgba(25,135,84,0.15)',
      colorBorder: 'rgba(25,135,84,0.6)'
    },
    {
      title: 'Card Danger',
      colorBg: 'rgba(220,53,69,0.15)',
      colorBorder: 'rgba(220,53,69,0.6)'
    }
  ];

  ngOnInit(): void {
    const theme = localStorage.getItem('theme') as any;
    if (theme) {
      this.changeTheme(theme);
    }
  }

  changeTheme(theme: 'AZUL' | 'VERDE' | 'ROJO' | 'NARANJA' | 'VIOLETA' | 'GRIS'): void {

    localStorage.setItem('theme', theme);
    const root = document.documentElement;

    switch (theme) {
      case 'AZUL':
        root.style.setProperty('--primary-color', '#0063A7');
        root.style.setProperty('--primary-color-hover', '#004f86');
        break;

      case 'VERDE':
        root.style.setProperty('--primary-color', '#91c55b');
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


}
