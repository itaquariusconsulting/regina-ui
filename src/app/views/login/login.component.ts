import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from "./../../services/auth.service";
import Swal from 'sweetalert2';
import { Response } from '../../models/response';
import { environment } from '../../../environments/environment';
import { RegSecUser } from '../../models/reg-sec-user';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [FormsModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginComponent implements OnInit, OnDestroy {
  authToken: string = "";
  username: string = ''; // Cambiado de email a username
  password: string = '';
  showPassword: boolean = false;
  errorMessage: string = '';
  windowForm: number = 0;
  valor1: string = '';
  valor2: string = '';
  valor3: string = '';
  valor4: string = '';
  otp: string = "";
  showButtonOTP: boolean = false;
  showButtonPeriodo: boolean = false;
  pendingOk: boolean = false;
  dtoUser: RegSecUser = new RegSecUser();

  constructor(private router: Router, private service: AuthService) {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
      // Redirige al Dashboard si la sesión está activa
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnInit(): void {
    document.documentElement.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    document.documentElement.style.overflow = '';
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword; // Alterna el estado
  }

  valida_login(): boolean {
    if ((this.dtoUser.userUsername == undefined || this.dtoUser.userUsername == null || this.dtoUser.userUsername.length < 3)
      || (this.dtoUser.userPassword == undefined || this.dtoUser.userPassword == null || this.dtoUser.userPassword == '')) {
      Swal.fire({
        title: 'Error!',
        text: "Debe ingresar credenciales de autenticación",
        icon: 'error',
        confirmButtonText: 'Intentar de nuevo'
      });
      return false;
    } else {
      return true;
    }
  }

  onLogin() {
    if (this.valida_login()) {
      this.pendingOk = !this.pendingOk;
      this.service.login(this.dtoUser).subscribe(
        (response: Response) => {
          if (response.error == 0) {
            if (response.resultado == undefined || response.resultado == null || response.resultado.length == 0) {
              this.windowForm = 1;
              this.onOtp();
            } else {
              this.dtoUser = response.resultado;
              this.authToken = this.dtoUser.authToken;
              this.dtoUser.authToken = '';
              sessionStorage.setItem('isLoggedIn', 'true');
              sessionStorage.setItem('authToken', this.authToken);
              sessionStorage.setItem('user', JSON.stringify(response.resultado));
              this.windowForm = 2;
              this.onIngresar();
            }
            this.pendingOk = false;
          } else {
            Swal.fire({
              title: 'Error!',
              text: "Credenciales Incorrectas",
              icon: 'error',
              confirmButtonText: 'Intentar de nuevo'
            })
            this.pendingOk = false;
          }
        },
        error => {
          Swal.fire({
            title: 'Error!',
            text: "Error en el Servicio de Autenticación ",
            icon: 'error',
            confirmButtonText: 'Intentar de nuevo'
          });
          this.pendingOk = false;
        }
      )
    }
  }

  onOtp() {
    this.service.otp(this.dtoUser).subscribe(
      (response: Response) => {
        if (response.error == 0) {
          this.dtoUser = response.resultado;
          this.authToken = this.dtoUser.authToken;
          this.dtoUser.authToken = '';
          sessionStorage.setItem('isLoggedIn', 'true');
          sessionStorage.setItem('authToken', this.authToken);
          sessionStorage.setItem('user', JSON.stringify(response.resultado));
          this.onIngresar();
        } else {
          Swal.fire({
            title: 'Error!',
            text: "Error en el Envío de Email",
            icon: 'error',
            confirmButtonText: 'Intentar de nuevo'
          })
        }
      },
      error => {
        Swal.fire({
          title: 'Error!',
          text: "Error en el Servicio de Autenticación",
          icon: 'error',
          confirmButtonText: 'Intentar de nuevo'
        })
      }
    )
  }

  onIngresar() {

    this.router.navigate(['/list-orders']);
    this.getConfiguracionSistema();
  }

  moveToNext(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.value.length === 1 && index < 4) {
      (document.getElementsByTagName('input')[index] as HTMLInputElement).focus();
    }
    this.otp = (this.valor1.concat(this.valor2).concat(this.valor3).concat(this.valor4)).trimEnd();
    if (this.otp.length == 4) {
      this.showButtonOTP = true;
    } else {
      this.showButtonOTP = false;
    }
  }

  getLastDayOfMonth(year: number, month: number): Date {
    return new Date(year, month + 1, 0);
  }

  getConfiguracionSistema(): void {
  }
}