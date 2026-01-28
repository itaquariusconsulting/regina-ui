import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface NavbarItem {
  label: string;
  icon?: string;
  route?: string;
  subitems?: NavbarItem[];
}

@Component({
  selector: 'app-default-footer-mobile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './default-footer-mobile.component.html',
  styleUrls: ['./default-footer-mobile.component.scss']
})
export class DefaultFooterMobileComponent {

  constructor(private router: Router) {}

  items: NavbarItem[] = [
    {
      label: 'Procesos',
      icon: 'fas fa-cog',
      subitems: [
        { label: 'Órdenes de Pago', icon: 'fa-solid fa-list', route: '/list-orders' },
        { label: 'Seguridad', icon: 'fas fa-user-shield', route: '/roles' }
      ]
    },
    {
      label: 'Configuración',
      icon: 'fas fa-wrench',
      route: '/settings'
    }
  ];

  openIndex: number | null = null;

  toggleDropdown(index: number) {
    this.openIndex = this.openIndex === index ? null : index;
  }

handleClick(route?: string) {
  // Siempre cierra el dropdown al hacer clic en un subitem
  this.openIndex = null;

  if (route) {
    console.log('Navegando a:', route);
    this.router.navigate([route]);
  }
}
}
