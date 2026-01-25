import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface SidebarItem {
  label: string;
  icon: string;
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

  items: SidebarItem[] = [
    {
      label: 'Dashboard',
      icon: 'fas fa-tachometer-alt',
      expanded: false,
      subitems: [
        { label: 'Usuarios', icon: 'fas fa-user' },
        { label: 'Roles', icon: 'fas fa-user-shield' }
      ]
    },
    {
      label: 'Settings',
      icon: 'fas fa-cog',
      expanded: false,
      subitems: [
        { label: 'Perfil', icon: 'fas fa-id-badge' },
        { label: 'Seguridad', icon: 'fas fa-lock' }
      ]
    }
  ];

  toggle(selectedItem: SidebarItem): void {
     this.items.forEach(item => {
    if (item === selectedItem) {
      item.expanded = !item.expanded;
    } else {
      item.expanded = false;
    }
  });
  }
}
