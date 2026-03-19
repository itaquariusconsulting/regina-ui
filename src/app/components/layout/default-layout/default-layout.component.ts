import { Component, OnInit, NgZone } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SidebarComponent } from '../../sidebar/sidebar.component';
import { DefaultHeaderComponent } from '../../layout/default-layout/default-header/default-header.component';
import { DeviceService } from '../../../services/core-service/device.service';
import { DefaultFooterMobileComponent } from '../../layout/default-layout/default-footer-mobile/default-footer-mobile.component';
import { DefaultFooterComponent } from './default-footer/default-footer.component';

import { ChatResponse, ReginaIaService } from '../../../services/regina-ia.service';
import { finalize } from 'rxjs/operators';
import { WrapperRequestIA } from '../../../models/wrappers/wrapper-request-ia';
import { environment } from '../../../../environments/environment';
import { AccountType } from '../../../shared/constants/accounts';

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
    private zone: NgZone,
    private reginaService: ReginaIaService,
    private deviceService: DeviceService
  ) { }

  user = sessionStorage.getItem('user')
    ? JSON.parse(sessionStorage.getItem('user')!)
    : null;

  isSidebarVisible = true;
  isDesktop: boolean = false;
  showReginaChat = false;

  userInput = '';
  messages: ChatMessage[] = [];

  recognition: any;

  saludoInicialMostrado = false;
  nombreUsuario = '';
  wrapperRequestIA: WrapperRequestIA = new WrapperRequestIA();

  retorno: any;

  showReginaIcon: boolean = true;

  isListening = false;
  mensajeRegina: string = "";

url: string = environment.apiUrlIA + "/chat";

  ngOnInit(): void {
    this.isDesktop = this.deviceService.isDesktopDevice();
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        this.wrapperRequestIA.userUserName = userObj.userUserName || '';
        this.wrapperRequestIA.codEmpresa = userObj.codEmpresa || '';
        this.wrapperRequestIA.codSucursal = userObj.codSucursal || '';
        this.wrapperRequestIA.anoPeriodo = sessionStorage.getItem('periodo_year') || '';
        this.wrapperRequestIA.codPeriodo = sessionStorage.getItem('periodo_month') || '';
        this.wrapperRequestIA.codAuxiliar = userObj.codAuxiliar || '';
        this.wrapperRequestIA.authToken = userObj.authToken || '';
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
      this.recognition.lang = 'es-PE';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onend = () => {
        this.zone.run(() => {
          this.isListening = false;
        });
      };

      this.recognition.onerror = () => {
        this.zone.run(() => {
          this.isListening = false;
        });
      };

    }
  }

  toggleMic(): void {

    if (this.isListening) {
      this.cancelarEscucha();
    } else {
      this.iniciarEscucha();
    }

  }

  iniciarEscucha(): void {

    if (!this.recognition) {
      return;
    }

    this.isListening = true;

    this.hablar();
  }

  cancelarEscucha(): void {

    if (this.recognition) {
      this.recognition.abort();
    }

    this.isListening = false;
  }

  toggleReginaChat(): void {
    this.showReginaIcon = !this.showReginaIcon;
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
      this.isListening = false;
      return;
    }

    this.recognition.onresult = (event: any) => {

      const texto = event.results[0][0].transcript;

      this.zone.run(() => {
        this.userInput = texto;
        this.enviarTexto();
      });
    };

    try {
      this.recognition.start();
    } catch (e) {
      // evita error si se intenta iniciar dos veces
    }

  }

  private procesarPregunta(texto: string): void {

    const textoNormalizado = texto.toLowerCase().trim();
    const nombre = this.nombreUsuario
      ? this.capitalizar(this.nombreUsuario.toLowerCase())
      : '';

    const esSaludo = /(hola|buenos días|buenas tardes|buenas noches|buen dia|buenas)/i
      .test(textoNormalizado);

    if (esSaludo) {

      const saludoHora = this.obtenerSaludoPorHora();

      const respuestaSaludo = nombre
        ? `${saludoHora} ${nombre}, ¿en qué puedo ayudarte hoy?`
        : `${saludoHora}, ¿en qué puedo ayudarte hoy?`;

      this.messages.push({ from: 'bot', text: respuestaSaludo });
      this.hablarTexto(respuestaSaludo, true);
      this.saludoInicialMostrado = true;

    } else {
      this.wrapperRequestIA.mensaje = texto;
      this.wrapperRequestIA.userUserName = 'mangulom';
      this.wrapperRequestIA.anoPeriodo = sessionStorage.getItem('periodo_year') || '';
      this.wrapperRequestIA.codPeriodo = sessionStorage.getItem('periodo_month') || '';
      this.wrapperRequestIA.codAuxiliar = this.user?.codAuxiliar || '';
      this.wrapperRequestIA.isAdmin = this.user?.userAdmin ? AccountType.ADMIN : AccountType.USER;

      this.reginaService.enviarPregunta(this.wrapperRequestIA)
        .pipe(finalize(() => { }))
        .subscribe({
          next: (res: ChatResponse) => {

            this.retorno = (res as any)['data'] || [];

            switch (res.tipo) {
              case 'ordenes':
                this.router.navigate(
                  ['/list-orders'],
                  { state: { data: this.retorno } }
                );
                break;

              case 'usuarios':
                this.router.navigate(
                  ['/list-usuarios'],
                  { state: { data: this.retorno } }
                );
                break;

              case 'usuario_true':
                this.router.navigate(['/nuevo-usuario']);
                break;
            }

            const respuesta = res.respuesta || 'No entendí eso, ¿podrías repetirlo?';

            this.messages.push({ from: 'bot', text: respuesta });
            this.mensajeRegina="SI ERROR";
            this.hablarTexto(respuesta);
          },
          error: (err) => {
            console.error(err);
            this.mensajeRegina = err;
            
            const errorTexto = 'Hubo un problema al conectar con Regina, lo siento.';
            this.messages.push({ from: 'bot', text: errorTexto });
            this.hablarTexto(errorTexto);
          }
        });

    }
  }

  private hablarTexto(texto: string, enfatizar: boolean = false): void {

    if (!('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;

    const decir = () => {

      const voces = synth.getVoices();

      let vozSeleccionada = voces.find(v =>
        v.lang.startsWith('es') &&
        (v.name.toLowerCase().includes('latino') ||
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('mujer') ||
          v.name.toLowerCase().includes('woman'))
      );

      if (!vozSeleccionada) {
        vozSeleccionada = voces.find(v => v.lang.startsWith('es'));
      }

      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-PE';
      utterance.voice = vozSeleccionada || null;
      utterance.rate = enfatizar ? 1.05 : 0.95;
      utterance.pitch = enfatizar ? 1.25 : 1.15;

      synth.cancel();
      synth.speak(utterance);
    };

    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = () => decir();
    } else {
      decir();
    }
  }

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
