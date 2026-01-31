import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { DefaultHeaderComponent } from '../../layout/default-layout/default-header/default-header.component';
import { DeviceService } from '../../../services/core-service/device.service';
import { DefaultFooterMobileComponent } from '../../layout/default-layout/default-footer-mobile/default-footer-mobile.component';
import { DefaultFooterComponent } from './default-footer/default-footer.component';
@Component({
  selector: 'app-default-layout',
  standalone: true,
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    DefaultHeaderComponent,
    DefaultFooterMobileComponent,
    DefaultFooterComponent
  ]
})
export class DefaultLayoutComponent implements OnInit {

  constructor(private router: Router, public deviceService: DeviceService) { }

  user = sessionStorage.getItem('user')
    ? JSON.parse(sessionStorage.getItem('user')!)
    : null;

  isSidebarVisible: boolean = true;
  isDesktop: boolean = true;
  showReginaChat = false;

  ngOnInit(): void {
    this.isDesktop = this.deviceService.isDesktopDevice();
  }

  toggleReginaChat(): void {
    this.showReginaChat = !this.showReginaChat;
  }

  getUserRole(): string {
    const userString = sessionStorage.getItem('user');
    if (userString) {
      try {
        const user = JSON.parse(userString);
        const permiso = user.permisos.find(
          (p: any) => p.codMenu === 14 && p.codItem === 1 && p.idProfile === user.idProfile
        );
        return permiso ? 'ADMIN' : 'USER';
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
