import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
/* import { SidebarRucComponent } from '../../components/sidebar-ruc/sidebar-ruc.component'; */
import { DefaultHeaderComponent } from '../../layout/default-layout/default-header/default-header.component';

@Component({
  selector: 'app-default-layout',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DefaultLayoutComponent implements OnInit {

  constructor(private router: Router) {

  }
  user = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')!) : null;
  isSidebarVisible: boolean = true;

  ngOnInit(): void {
  }

  getUserRole(): string {
    const userString = sessionStorage.getItem('user');
    if (userString) {
      try {
        const user = JSON.parse(userString);
        const permiso = user.permisos.find(
          (p: any) => p.codMenu === 14 && p.codItem === 1 && p.idProfile === user.idProfile
        );
        return permiso ? 'ADMIN' : 'USER'
      } catch (e) {
        console.error('Error al parsear User desde sessionStorage', e);
        return 'USER';
      }
    }
    return 'USER';
  }

  isActive(url: string): boolean {
    return window.location.pathname === url;
  }


  toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible;
  }

  logActiveComponent() {
    const activeRoute = this.router.routerState.root.firstChild;
    if (activeRoute) {
      console.log('Componente activo:', activeRoute.component);
    } else {
      console.log('No hay componente activo');
    }
  }
}
