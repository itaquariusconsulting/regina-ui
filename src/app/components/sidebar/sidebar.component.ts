import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeviceService } from '../../services/core-service/device.service';

interface SidebarItem {
  label: string;
  icon: string;
  route?: string;
  subitems?: SidebarItem[];
  expanded?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {

  constructor(private router: Router) { }

  items: SidebarItem[] = [
    {
      label: 'Procesos',
      icon: 'fas fa-cog',
      expanded: false,
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

  toggle(item: SidebarItem): void {
    // Navega si tiene ruta
    if (item.route) {
      this.router.navigate([item.route]);
    }

    // Expande / colapsa si tiene subitems
    if (item.subitems?.length) {
      this.items.forEach(i => {
        if (i === item) {
          i.expanded = !i.expanded;
        } else {
          i.expanded = false;
        }
      });
    }
  }

  navigate(sub: SidebarItem, event: MouseEvent): void {
    event.stopPropagation(); // evita que el click cierre el menú

    if (sub.route) {
      this.router.navigate([sub.route]);
    }
  }
}
