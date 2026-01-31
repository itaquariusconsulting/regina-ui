import { Component, OnInit, NgZone } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SidebarComponent } from '../../sidebar/sidebar.component';
import { DefaultHeaderComponent } from '../../layout/default-layout/default-header/default-header.component';
import { DeviceService } from '../../../services/core-service/device.service';
import { DefaultFooterMobileComponent } from '../../layout/default-layout/default-footer-mobile/default-footer-mobile.component';
import { DefaultFooterComponent } from './default-footer/default-footer.component';

import { ReginaIaService } from '../../../services/regina-ia.service'; // <-- agregado
import { finalize } from 'rxjs/operators';

interface ChatMessage {
  from: 'user' | 'bot';
  text: string;
}

@Component({
  selector: 'app-default-layout',
  standalone: true,
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    CommonModule,
    RouterOutlet,
    FormsModule,
    SidebarComponent,
    DefaultHeaderComponent,
    DefaultFooterMobileComponent,
    DefaultFooterComponent
  ]
})
export class DefaultLayoutComponent implements OnInit {

  constructor(
    private router: Router,
    public deviceService: DeviceService,
    private zone: NgZone,
    private reginaService: ReginaIaService // <-- inyección del servicio
  ) {}

  user = sessionStorage.getItem('user')
    ? JSON.parse(sessionStorage.getItem('user')!)
    : null;

  isSidebarVisible = true;
  isDesktop = true;
  showReginaChat = false;

  userInput = '';
  messages: ChatMessage[] = [];

  private recognition: any;

  private saludoInicialMostrado = false;
  private nombreUsuario = '';

  ngOnInit(): void {

    this.isDesktop = this.deviceService.isDesktopDevice();

    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        this.nombreUsuario = userObj.userName || '';
      } catch {
        this.nombreUsuario = '';
      }
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
    }
  }

  toggleReginaChat(): void {
    this.showReginaChat = !this.showReginaChat;
  }

  toggleSidebar() {
    this.isSidebarVisible = !this.isSidebarVisible;
  }

  enviarTexto(): void {

    const texto = this.userInput?.trim();
    if (!texto) return;

    this.messages.push({ from: 'user', text: texto });
    this.userInput = '';

    this.procesarPregunta(texto);
  }

  hablar(): void {

    if (!this.recognition) {
      alert('El reconocimiento de voz no está soportado en este navegador.');
      return;
    }

    this.recognition.onresult = (event: any) => {

      const texto = event.results[0][0].transcript;

      this.zone.run(() => {
        this.userInput = texto;
        this.enviarTexto();
      });
    };

    this.recognition.start();
  }

  /* =========================================
     Lógica principal de Regina
     ========================================= */

  private procesarPregunta(texto: string): void {

    const textoNormalizado = texto.toLowerCase().trim();

    const nombre = this.nombreUsuario
      ? this.capitalizar(this.nombreUsuario.toLowerCase())
      : '';

    const esSaludo = /(hola|buenos días|buenas tardes|buenas noches|buen dia|buenas)/i
      .test(textoNormalizado);

    // ------------------------------------------------
    // 1. Si el usuario saluda → responder saludo
    // ------------------------------------------------
    if (esSaludo) {

      const saludoHora = this.obtenerSaludoPorHora();

      const respuestaSaludo = nombre
        ? `${saludoHora} ${nombre}. ¿En qué te puedo ayudar?`
        : `${saludoHora}. ¿En qué te puedo ayudar?`;

      this.messages.push({ from: 'bot', text: respuestaSaludo });
      this.hablarTexto(respuestaSaludo);

      this.saludoInicialMostrado = true;
      return;
    }

    // ------------------------------------------------
    // 2. Saludo automático inicial
    // ------------------------------------------------
    if (!this.saludoInicialMostrado) {

      this.saludoInicialMostrado = true;

      const saludoHora = this.obtenerSaludoPorHora();

      const saludoInicial = nombre
        ? `${saludoHora} ${nombre}, soy Regina. Un gusto ayudarte. ¿En qué te puedo apoyar hoy?`
        : `${saludoHora}, soy Regina. Un gusto ayudarte. ¿En qué te puedo apoyar hoy?`;

      this.messages.push({ from: 'bot', text: saludoInicial });
      this.hablarTexto(saludoInicial);
    }

    // ------------------------------------------------
    // 3. Llamada al webservice de Regina
    // ------------------------------------------------
    this.reginaService.enviarPregunta(texto)
      .pipe(finalize(() => {
        // Puedes agregar algún loader si deseas
      }))
      .subscribe({
        next: (res: any) => {
          const respuesta = res.respuesta || 'No se obtuvo respuesta del servicio';
          this.messages.push({ from: 'bot', text: respuesta });
          this.hablarTexto(respuesta);
        },
        error: (err) => {
          console.error(err);
          const errorTexto = 'Error al comunicarse con el servicio de Regina.';
          this.messages.push({ from: 'bot', text: errorTexto });
          this.hablarTexto(errorTexto);
        }
      });

    // ------------------------------------------------
    // 4. Respuesta normal placeholder (manteniendo todo)
    // ------------------------------------------------
    const respuesta = `Recibí tu mensaje: ${texto}`;
    this.messages.push({ from: 'bot', text: respuesta });
    this.hablarTexto(respuesta);
  }

  /* =========================================
     Texto → voz (voz femenina si existe)
     ========================================= */

  private hablarTexto(texto: string): void {

    if (!('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;

    const decir = () => {

      const voces = synth.getVoices();

      let vozSeleccionada =
        voces.find(v =>
          v.lang.startsWith('es') &&
          (
            v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('woman') ||
            v.name.toLowerCase().includes('mujer')
          )
        );

      if (!vozSeleccionada) {
        vozSeleccionada = voces.find(v => v.lang.startsWith('es'));
      }

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-PE';
      utterance.voice = vozSeleccionada || null;
      utterance.rate = 0.95;
      utterance.pitch = 1.15;

      synth.cancel();
      synth.speak(utterance);
    };

    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = () => decir();
    } else {
      decir();
    }
  }

  /* =========================================
     Utilitarios
     ========================================= */

  private obtenerSaludoPorHora(): string {

    const ahora = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })
    );

    const hora = ahora.getHours();

    if (hora >= 5 && hora < 12) return 'Buenos días';
    if (hora >= 12 && hora < 18) return 'Buenas tardes';

    return 'Buenas noches';
  }

  private capitalizar(texto: string): string {
    if (!texto) return texto;
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
  }

  /* =========================================
     Código original del layout
     ========================================= */

  getUserRole(): string {
    const userString = sessionStorage.getItem('user');
    if (userString) {
      try {
        const user = JSON.parse(userString);
        const permiso = user.permisos.find(
          (p: any) =>
            p.codMenu === 14 &&
            p.codItem === 1 &&
            p.idProfile === user.idProfile
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

  logActiveComponent() {
    const activeRoute = this.router.routerState.root.firstChild;
    if (activeRoute) {
      console.log('Componente activo:', activeRoute.component);
    } else {
      console.log('No hay componente activo');
    }
  }
}
