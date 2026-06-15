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

  /**
   * Mapeo de iconos FontAwesome (vienen de la BD) → emojis a color.
   * Si el item ya trae un emoji directamente en `icon`, se usa tal cual.
   * Si no encuentra mapeo, usa un emoji por defecto.
   */
  private iconoMap: { [key: string]: string } = {
    // Órdenes / pagos
    'fa-file-invoice-dollar': '💰',
    'fa-file-invoice':        '🧾',
    'fa-money-bill':          '💵',
    'fa-money-bill-wave':     '💵',
    'fa-coins':               '🪙',
    'fa-receipt':             '🧾',
    'fa-cash-register':       '💳',
    'fa-credit-card':         '💳',

    // Usuarios / seguridad
    'fa-users':         '👥',
    'fa-user':          '👤',
    'fa-user-plus':     '👤',
    'fa-user-shield':   '🛡️',
    'fa-id-card':       '🪪',
    'fa-id-badge':      '🪪',
    'fa-lock':          '🔒',
    'fa-unlock':        '🔓',
    'fa-key':           '🔑',
    'fa-shield-alt':    '🛡️',

    // Documentos / listas
    'fa-list':          '📃',
    'fa-list-ul':       '📋',
    'fa-list-ol':       '📋',
    'fa-list-alt':      '📋',
    'fa-clipboard':     '📋',
    'fa-clipboard-check':'✅',
    'fa-clipboard-list':'📋',
    'fa-file':          '📄',
    'fa-file-alt':      '📄',
    'fa-file-pdf':      '📕',
    'fa-folder':        '📁',
    'fa-folder-open':   '📂',
    'fa-book':          '📘',
    'fa-book-open':     '📖',

    // Operativos
    'fa-cubes':         '📦',
    'fa-cube':          '📦',
    'fa-box':           '📦',
    'fa-boxes':         '📦',
    'fa-warehouse':     '🏭',
    'fa-truck':         '🚚',
    'fa-car':           '🚗',
    'fa-route':         '🛣️',
    'fa-map':           '🗺️',
    'fa-map-marker':    '📍',

    // Permisos / config
    'fa-cog':           '⚙️',
    'fa-cogs':          '⚙️',
    'fa-tools':         '🛠️',
    'fa-wrench':        '🔧',
    'fa-sliders-h':     '🎚️',
    'fa-tasks':         '📋',
    'fa-check':         '✅',
    'fa-check-circle':  '✅',
    'fa-check-double':  '✔️',

    // Charts / dashboard
    'fa-chart-pie':     '🥧',
    'fa-chart-bar':     '📊',
    'fa-chart-line':    '📈',
    'fa-tachometer-alt':'⏱️',

    // Validación
    'fa-vial':          '🧪',
    'fa-flask':         '⚗️',
    'fa-microscope':    '🔬',
    'fa-search':        '🔍',
    'fa-filter':        '🧰',

    // Otros
    'fa-home':          '🏠',
    'fa-tag':           '🏷️',
    'fa-tags':          '🏷️',
    'fa-bell':          '🔔',
    'fa-envelope':      '✉️',
    'fa-paper-plane':   '✈️',
    'fa-archive':       '🗄️',
    'fa-database':      '🗃️',
    'fa-server':        '🖥️',
    'fa-link':          '🔗',
    'fa-robot':         '🤖',
    'fa-exclamation-triangle': '⚠️',
    'fa-exclamation-circle':   '❗'
  };

  /** Por defecto cuando no hay match */
  private iconoDefecto = '🔹';

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

  goDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goReportes(): void {
    this.router.navigate(['/reportes']);
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

  /**
   * Resuelve qué icono mostrar para un item del menú dinámico:
   * - Si `icon` ya es un emoji (caracter no-ASCII), se devuelve tal cual.
   * - Si es una clase de FontAwesome conocida, se mapea a emoji.
   * - Si no, se usa un emoji por defecto.
   */
  iconoPara(item: NavItem): string {
    const icon = (item?.icon || '').trim();
    if (!icon) return this.iconoDefecto;

    // Si ya es emoji (no tiene caracteres ASCII de letra) lo dejamos
    const esEmoji = !/[a-zA-Z\-\s]/.test(icon);
    if (esEmoji) return icon;

    // Buscar coincidencia exacta en el mapa (las clases pueden venir con prefijo "fas " o "fa-solid ")
    for (const key of Object.keys(this.iconoMap)) {
      if (icon.includes(key)) return this.iconoMap[key];
    }

    return this.iconoDefecto;
  }
}
