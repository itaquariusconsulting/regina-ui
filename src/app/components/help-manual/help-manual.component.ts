import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface HelpSubsection {
  id: string;
  title: string;
  icon?: string;
}

export interface HelpSection {
  id: string;
  title: string;
  icon: string;
  description?: string;
  subsections?: HelpSubsection[];
}

@Component({
  selector: 'app-help-manual',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './help-manual.component.html',
  styleUrl: './help-manual.component.scss'
})
export class HelpManualComponent implements OnInit {

  @Input() visible: boolean = false;
  @Output() closeManual = new EventEmitter<void>();

  searchQuery: string = '';
  activeSectionId: string = 'introduccion';
  activeSubsectionId: string = '';
  showSidebarMobile: boolean = false;
  expandedSections: { [key: string]: boolean } = {};

  sections: HelpSection[] = [
    {
      id: 'introduccion',
      title: 'Introducción',
      icon: 'fas fa-rocket',
      description: 'Bienvenida y vista general del sistema Regina.',
      subsections: [
        { id: 'que-es-regina', title: '¿Qué es Regina?', icon: 'fas fa-star' },
        { id: 'requisitos', title: 'Requisitos del Sistema', icon: 'fas fa-laptop' },
        { id: 'glosario', title: 'Glosario de Términos', icon: 'fas fa-book' }
      ]
    },
    {
      id: 'inicio-sesion',
      title: 'Inicio de Sesión',
      icon: 'fas fa-key',
      description: 'Ingreso al sistema, OTP y recuperación de acceso.',
      subsections: [
        { id: 'login-credenciales', title: 'Credenciales', icon: 'fas fa-user-lock' },
        { id: 'login-otp', title: 'Verificación OTP', icon: 'fas fa-shield-alt' },
        { id: 'login-cambio-password', title: 'Cambio de Contraseña', icon: 'fas fa-redo' }
      ]
    },
    {
      id: 'interfaz',
      title: 'Interfaz Principal',
      icon: 'fas fa-th-large',
      description: 'Conoce el header, sidebar, chat de Regina y áreas de trabajo.',
      subsections: [
        { id: 'header', title: 'Barra de Cabecera', icon: 'fas fa-window-maximize' },
        { id: 'sidebar', title: 'Menú Lateral con Iconos', icon: 'fas fa-bars' },
        { id: 'sidebar-flecha', title: 'Flechas de Expansión Inteligentes', icon: 'fas fa-chevron-down' },
        { id: 'chat-regina', title: 'Chat de Regina (esquina izquierda)', icon: 'fas fa-comments' },
        { id: 'temas', title: 'Personalización de Temas', icon: 'fas fa-palette' },
        { id: 'tipo-cambio', title: 'Tipo de Cambio', icon: 'fas fa-dollar-sign' },
        { id: 'periodo', title: 'Periodo Activo', icon: 'fas fa-calendar-alt' },
        { id: 'pantalla-inicio', title: 'Pantalla por Defecto', icon: 'fas fa-home' }
      ]
    },
    {
      id: 'dashboard',
      title: 'Dashboard Ejecutivo',
      icon: 'fas fa-chart-line',
      description: 'KPIs, gráficos y métricas en tiempo real de tu operación.',
      subsections: [
        { id: 'dash-overview', title: 'Vista General', icon: 'fas fa-eye' },
        { id: 'dash-filtros', title: 'Filtros Inteligentes', icon: 'fas fa-filter' },
        { id: 'dash-kpis', title: 'KPI Cards', icon: 'fas fa-th' },
        { id: 'dash-charts', title: 'Tipos de Gráficos', icon: 'fas fa-chart-pie' },
        { id: 'dash-admin-vs-user', title: 'Vista Admin vs Usuario', icon: 'fas fa-user-shield' }
      ]
    },
    {
      id: 'reportes',
      title: 'Centro de Reportes',
      icon: 'fas fa-file-pdf',
      description: 'Genera PDFs profesionales con todos los datos de tu operación.',
      subsections: [
        { id: 'rep-acceso', title: 'Cómo acceder', icon: 'fas fa-mouse-pointer' },
        { id: 'rep-rendicion', title: 'Reporte de Rendición', icon: 'fas fa-receipt' },
        { id: 'rep-planillas', title: 'Reporte de Planillas de Movilidad', icon: 'fas fa-route' },
        { id: 'rep-cumplimiento', title: 'Reporte de Cumplimiento', icon: 'fas fa-chart-line' },
        { id: 'rep-cc', title: 'Reporte por Centro de Costos', icon: 'fas fa-building' },
        { id: 'rep-beneficiarios', title: 'Reporte por Beneficiario', icon: 'fas fa-users' },
        { id: 'rep-vencimientos', title: 'Reporte de Vencimientos', icon: 'fas fa-exclamation-triangle' },
        { id: 'rep-sunat', title: 'Reporte SUNAT', icon: 'fas fa-check-double' },
        { id: 'rep-comportamiento', title: 'Descarga + Vista Previa', icon: 'fas fa-download' }
      ]
    },
    {
      id: 'ordenes-pago',
      title: 'Órdenes de Pago',
      icon: 'fas fa-file-invoice-dollar',
      description: 'Gestión completa del ciclo de vida de las órdenes.',
      subsections: [
        { id: 'op-listar', title: 'Listar Órdenes', icon: 'fas fa-list' },
        { id: 'op-estados', title: 'Estados (EM/PE/LQ/PR)', icon: 'fas fa-tags' },
        { id: 'op-acciones', title: 'Botones de Acción por Fila', icon: 'fas fa-mouse-pointer' },
        { id: 'op-pdf', title: 'Botón PDF (solo LQ)', icon: 'fas fa-file-pdf' },
        { id: 'op-detalle', title: 'Detalle de Orden', icon: 'fas fa-eye' },
        { id: 'op-asiento', title: 'Asiento Contable', icon: 'fas fa-balance-scale' },
        { id: 'op-filtros', title: 'Búsqueda y Paginación', icon: 'fas fa-filter' }
      ]
    },
    {
      id: 'rendir-cuenta',
      title: 'Rendir Cuenta',
      icon: 'fas fa-receipt',
      description: 'Rendición digital con OCR avanzado y validación SUNAT.',
      subsections: [
        { id: 'rc-ocr', title: 'Captura por OCR', icon: 'fas fa-camera' },
        { id: 'rc-recorte', title: 'Recorte de Imagen', icon: 'fas fa-crop' },
        { id: 'rc-sunat', title: 'Validación SUNAT (RUC)', icon: 'fas fa-check-double' },
        { id: 'rc-detalle', title: 'Datos del Comprobante', icon: 'fas fa-edit' },
        { id: 'rc-comercial', title: 'Nombre Comercial vs Razón Social', icon: 'fas fa-store' },
        { id: 'rc-duplicado', title: 'Validación de Documento Duplicado', icon: 'fas fa-copy' },
        { id: 'rc-legibilidad', title: 'Documento No Legible', icon: 'fas fa-eye-slash' },
        { id: 'rc-mejorar-imagen', title: 'Mejorar Imagen (Doble Pasada)', icon: 'fas fa-camera-rotate' },
        { id: 'rc-periodo', title: 'Mes / Año de Declaración', icon: 'fas fa-calendar-alt' },
        { id: 'rc-igv', title: '% IGV Editable', icon: 'fas fa-percentage' },
        { id: 'rc-fecha-rendicion', title: 'Fecha de Rendición', icon: 'fas fa-calendar-day' },
        { id: 'rc-guardar', title: 'Guardar y Validar', icon: 'fas fa-save' }
      ]
    },
    {
      id: 'planilla-movilidad',
      title: 'Planilla de Movilidad',
      icon: 'fas fa-route',
      description: 'Registro de viajes, ocupantes y exportación a PDF.',
      subsections: [
        { id: 'pm-cabecera', title: 'Cabecera de Planilla', icon: 'fas fa-heading' },
        { id: 'pm-detalle', title: 'Detalle de Viajes', icon: 'fas fa-map-marker-alt' },
        { id: 'pm-direcciones', title: 'Dirección Origen / Destino', icon: 'fas fa-map' },
        { id: 'pm-ocupantes', title: 'Ocupantes (con Buscador)', icon: 'fas fa-users' },
        { id: 'pm-importe-max', title: 'Importe Máximo por Día', icon: 'fas fa-shield-alt' },
        { id: 'pm-totales', title: 'Totales y Devolución', icon: 'fas fa-coins' },
        { id: 'pm-pdf', title: 'Exportar a PDF', icon: 'fas fa-file-pdf' }
      ]
    },
    {
      id: 'usuarios',
      title: 'Usuarios',
      icon: 'fas fa-users',
      description: 'Crear, editar y administrar usuarios del sistema.',
      subsections: [
        { id: 'us-listar', title: 'Listar Usuarios', icon: 'fas fa-list-ul' },
        { id: 'us-nuevo', title: 'Nuevo Usuario', icon: 'fas fa-user-plus' },
        { id: 'us-editar', title: 'Editar Usuario', icon: 'fas fa-user-edit' },
        { id: 'us-eliminar', title: 'Eliminar Usuario', icon: 'fas fa-user-minus' },
        { id: 'us-estado', title: 'Estado (Activo/Inactivo)', icon: 'fas fa-toggle-on' }
      ]
    },
    {
      id: 'perfiles',
      title: 'Perfiles',
      icon: 'fas fa-id-card',
      description: 'Perfiles de acceso y agrupación de permisos.',
      subsections: [
        { id: 'pf-listar', title: 'Listar Perfiles', icon: 'fas fa-list' },
        { id: 'pf-nuevo', title: 'Crear Perfil', icon: 'fas fa-plus' },
        { id: 'pf-editar', title: 'Editar Perfil', icon: 'fas fa-pen' },
        { id: 'pf-eliminar', title: 'Eliminar Perfil', icon: 'fas fa-trash' }
      ]
    },
    {
      id: 'permisos',
      title: 'Matriz de Permisos',
      icon: 'fas fa-lock',
      description: 'Configuración granular de permisos por perfil.',
      subsections: [
        { id: 'pm-seleccion', title: 'Selección de Perfil', icon: 'fas fa-mouse-pointer' },
        { id: 'pm-acciones', title: 'Ver / Crear / Editar / Eliminar', icon: 'fas fa-tasks' },
        { id: 'pm-jerarquia', title: 'Jerarquía Padre-Hijo', icon: 'fas fa-sitemap' },
        { id: 'pm-guardar', title: 'Sincronizar Cambios', icon: 'fas fa-sync-alt' }
      ]
    },
    {
      id: 'validaciones',
      title: 'Validaciones OCR',
      icon: 'fas fa-clipboard-check',
      description: 'Reglas y palabras clave para detectar comprobantes.',
      subsections: [
        { id: 'vl-listar', title: 'Listar Reglas', icon: 'fas fa-list-alt' },
        { id: 'vl-nueva', title: 'Crear Regla', icon: 'fas fa-plus-circle' },
        { id: 'vl-keywords', title: 'Palabras Clave', icon: 'fas fa-tag' },
        { id: 'vl-secciones', title: 'Secciones del Documento', icon: 'fas fa-puzzle-piece' }
      ]
    },
    {
      id: 'regina-ia',
      title: 'Asistente Regina IA',
      icon: 'fas fa-robot',
      description: 'Chatbot inteligente con voz y comandos.',
      subsections: [
        { id: 'ia-chat', title: 'Chat por Texto', icon: 'fas fa-comment' },
        { id: 'ia-voz', title: 'Reconocimiento de Voz', icon: 'fas fa-microphone' },
        { id: 'ia-comandos', title: 'Comandos Disponibles', icon: 'fas fa-terminal' },
        { id: 'ia-respuestas', title: 'Respuestas Habladas', icon: 'fas fa-volume-up' }
      ]
    },
    {
      id: 'configuracion',
      title: 'Configuración Personal',
      icon: 'fas fa-cog',
      description: 'Preferencias del usuario, tema y sesión.',
      subsections: [
        { id: 'cf-perfil', title: 'Mi Perfil', icon: 'fas fa-user-circle' },
        { id: 'cf-tema', title: 'Cambiar Tema', icon: 'fas fa-paint-roller' },
        { id: 'cf-password', title: 'Cambiar Contraseña', icon: 'fas fa-lock' },
        { id: 'cf-cerrar', title: 'Cerrar Sesión', icon: 'fas fa-sign-out-alt' }
      ]
    },
    {
      id: 'consejos',
      title: 'Buenas Prácticas',
      icon: 'fas fa-lightbulb',
      description: 'Recomendaciones, atajos y resolución de problemas.',
      subsections: [
        { id: 'tips-seguridad', title: 'Seguridad', icon: 'fas fa-user-shield' },
        { id: 'tips-rendimiento', title: 'Rendimiento', icon: 'fas fa-tachometer-alt' },
        { id: 'tips-ocr', title: 'OCR de Calidad', icon: 'fas fa-image' },
        { id: 'tips-faq', title: 'Preguntas Frecuentes', icon: 'fas fa-question-circle' }
      ]
    },
    {
      id: 'soporte',
      title: 'Soporte y Contacto',
      icon: 'fas fa-life-ring',
      description: 'Cómo y cuándo contactar al equipo de soporte.',
      subsections: [
        { id: 'sp-canales', title: 'Canales de Atención', icon: 'fas fa-headset' },
        { id: 'sp-incidencias', title: 'Reportar Incidencias', icon: 'fas fa-bug' },
        { id: 'sp-version', title: 'Versión del Sistema', icon: 'fas fa-code-branch' }
      ]
    }
  ];

  ngOnInit(): void {
    this.expandedSections[this.activeSectionId] = true;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible) this.close();
  }

  close(): void {
    this.searchQuery = '';
    this.showSidebarMobile = false;
    this.closeManual.emit();
  }

  toggleSection(sectionId: string): void {
    this.expandedSections[sectionId] = !this.expandedSections[sectionId];
  }

  selectSection(sectionId: string, subsectionId: string = ''): void {
    this.activeSectionId = sectionId;
    this.activeSubsectionId = subsectionId;
    this.expandedSections[sectionId] = true;
    this.showSidebarMobile = false;

    setTimeout(() => {
      const target = subsectionId
        ? document.getElementById('hm-sub-' + subsectionId)
        : document.getElementById('hm-sec-' + sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  toggleMobileSidebar(): void {
    this.showSidebarMobile = !this.showSidebarMobile;
  }

  get filteredSections(): HelpSection[] {
    const term = this.searchQuery.trim().toLowerCase();
    if (!term) {
      return this.sections;
    }

    const result: HelpSection[] = [];

    for (const section of this.sections) {
      const titleMatch = section.title.toLowerCase().includes(term);
      const descMatch = (section.description || '').toLowerCase().includes(term);
      const subs: HelpSubsection[] = section.subsections || [];
      const filteredSubs: HelpSubsection[] = subs.filter(s =>
        s.title.toLowerCase().includes(term)
      );

      if (titleMatch || descMatch || filteredSubs.length > 0) {
        const finalSubs: HelpSubsection[] =
          filteredSubs.length > 0 ? filteredSubs : subs;

        result.push({
          id: section.id,
          title: section.title,
          icon: section.icon,
          description: section.description,
          subsections: finalSubs
        });
      }
    }

    return result;
  }

  printManual(): void {
    window.print();
  }

  scrollContentTop(): void {
    const el = document.querySelector('.hm-content');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
