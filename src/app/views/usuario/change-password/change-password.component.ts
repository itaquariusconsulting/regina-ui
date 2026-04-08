import { CommonModule, Location } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { RegSecUser } from '../../../models/reg-sec-user';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss'
})
export class ChangePasswordComponent {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrent = false;
  showNew = false;
  showConfirm = false;

  isSubmitting = false;
  isLoading$: Observable<boolean>;

  private readonly authToken = sessionStorage.getItem('authToken') || '';
  private readonly user: RegSecUser = JSON.parse(sessionStorage.getItem('user') || '{}');

  constructor(
    private authService: AuthService,
    private location: Location,
    private loadingService: LoadingService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  get passwordsMismatch(): boolean {
    return !!this.newPassword && !!this.confirmPassword && this.newPassword !== this.confirmPassword;
  }

  get canSubmit(): boolean {
    return !!this.currentPassword && !!this.newPassword && !!this.confirmPassword && !this.passwordsMismatch;
  }

  onBack(): void {
    this.location.back();
  }

  onSave(): void {
    if (!this.canSubmit) {
      Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: this.passwordsMismatch
            ? 'La confirmación no coincide con la nueva contraseña.'
            : 'Completa todos los campos para continuar.',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true
        });
      return;
    }

    if (this.currentPassword === this.newPassword) {
      Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: 'La nueva contraseña debe ser diferente a la actual.',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true
        });
      return;
    }

    const dto: RegSecUser = {
      authToken: this.authToken,
      userId: this.user.userId,
      userOldPassword: this.currentPassword,
      userPassword: this.newPassword
    };

    this.isSubmitting = true;
    this.loadingService.show();

    this.authService.changePassword(dto).subscribe({
      next: () => {
        this.loadingService.hide();
        this.isSubmitting = false;

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Tu contraseña se actualizó correctamente.',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true
        });

        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.loadingService.hide();
        this.isSubmitting = false;

        const mensaje = err?.error?.mensaje || 'No se pudo actualizar la contraseña. Intenta nuevamente.';
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: mensaje,
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true
        });
      }
    });
  }
}
