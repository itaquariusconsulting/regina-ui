import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeviceService } from '../../services/core-service/device.service';
import { NavItem } from '../../models/globals/nav-item';
import { Response } from '../../models/response';
import { RegSecPermissions } from '../../models/reg-sec-permissions';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {

  constructor(private router: Router, private authService: AuthService, private deviceService: DeviceService) { }

  codEmpresa: string = sessionStorage.getItem('codempresa') || '';
  userId: number = -1;
  items: NavItem[] = [];
  isDesktop: boolean = false;

  ngOnInit(): void {
    const userString = sessionStorage.getItem('user');
    const user = JSON.parse(userString || '{}');
    this.userId = user.userId;
    this.authService.obtenerItemsMenu(this.userId, this.codEmpresa).subscribe(
      (response: any) => {
        this.items = response;
      }
    )
    this.isDesktop = this.deviceService.isDesktopDevice();
  }

  home(): void {
    this.router.navigate(['/home']);
  }

  toggle(item: NavItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
    }

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

  navigate(sub: NavItem, event: MouseEvent): void {
    event.stopPropagation(); // evita que el click cierre el menú

    if (sub.route) {
      this.router.navigate([sub.route]);
    }
  }
}
