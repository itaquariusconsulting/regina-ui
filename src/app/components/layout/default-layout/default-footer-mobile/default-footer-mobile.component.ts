import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NavItem } from '../../../../models/globals/nav-item';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-default-footer-mobile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './default-footer-mobile.component.html',
  styleUrls: ['./default-footer-mobile.component.scss']
})
export class DefaultFooterMobileComponent implements OnInit {

  constructor(private router: Router, private authService: AuthService) { }

  items: NavItem[] = [];
  userId: number = -1;
  codEmpresa: string = sessionStorage.getItem('codempresa') || '';
  openIndex: number | null = null;

  ngOnInit(): void {
    const userString = sessionStorage.getItem('user');
    const user = JSON.parse(userString || '{}');
    this.userId = user.userId;
    this.authService.obtenerItemsMenu(this.userId, this.codEmpresa).subscribe(
      (response: any) => {
        this.items = response;
      }
    )
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
  event.stopPropagation();

  this.openIndex = null;   // 🔹 cierra el menú

  if (sub.route) {
    this.router.navigate([sub.route]);
  }
}

  toggleDropdown(index: number) {
    this.openIndex = this.openIndex === index ? null : index;
  }

  handleClick(route?: string, event?: Event) {
    if (event) {
      event.stopPropagation(); // 🔹 evita que el padre vuelva a abrir el menú
    }
    this.openIndex = null; // 🔹 cierra el dropdown
    if (route) {
      this.router.navigate([route]);
    }
  }
}
