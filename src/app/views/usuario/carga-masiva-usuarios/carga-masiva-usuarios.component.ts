import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { Response } from '../../../models/response';
import { RegSecUserService } from '../../../services/reg-sec-user.service';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';

/** Una fila del Excel tal como la devuelve el backend. */
export interface FilaCargaUsuario {
  fila: number;
  codAuxiliar: string;
  numDocumento: string;
  apePaterno: string;
  apeMaterno: string;
  nombres: string;
  correo: string;
  usuario: string;
  perfil: string;
  codSucursal: string;
  estado: 'LISTO' | 'CARGADO' | 'OMITIDO' | 'ERROR';
  detalle: string;
  userId?: number;
}

/**
 * Alta de usuarios desde un Excel.
 *
 * El flujo es a proposito en dos pasos: primero se valida (el backend no
 * escribe nada y devuelve fila por fila que pasaria) y recien despues se
 * carga. Cargar directo sobre un archivo de 200 filas y descubrir el problema
 * despues no tiene vuelta atras comoda.
 */
@Component({
  selector: 'app-carga-masiva-usuarios',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './carga-masiva-usuarios.component.html',
})
export class CargaMasivaUsuariosComponent implements OnInit {

  constructor(
    private regSecUserService: RegSecUserService,
    private loadingService: LoadingService,
    private location: Location,
    private dialog: MatDialog,
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  isLoading$: Observable<boolean>;

  usuarioActualId: number | null = null;
  codEmpresa = '';
  codSucursal = '001';
  perfil = 'USUARIO';
  contrasena = '';

  archivo: File | null = null;
  nombreArchivo = '';

  filas: FilaCargaUsuario[] = [];
  yaValidado = false;
  yaCargado = false;
  mensaje = '';

  ngOnInit(): void {
    const userString = sessionStorage.getItem('user');
    if (!userString) { return; }
    try {
      const user = JSON.parse(userString);
      this.usuarioActualId = user.userId ?? null;
      this.codEmpresa = user.codEmpresa || '';
      this.codSucursal = user.codSucursal || '001';
    } catch (e) {
      console.error('Error al parsear User desde sessionStorage', e);
    }
  }

  // ------------------------------------------------------------------
  // Archivo
  // ------------------------------------------------------------------

  onArchivoSeleccionado(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const elegido = input.files && input.files.length > 0 ? input.files[0] : null;

    this.archivo = elegido;
    this.nombreArchivo = elegido ? elegido.name : '';

    // Cambiar de archivo invalida lo validado antes.
    this.filas = [];
    this.yaValidado = false;
    this.yaCargado = false;
    this.mensaje = '';
  }

  descargarPlantilla(): void {
    this.regSecUserService.descargarPlantillaUsuarios().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'plantilla-carga-usuarios.xlsx';
        enlace.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.avisar('No se pudo descargar', 'La plantilla no esta disponible en el servidor.'),
    });
  }

  // ------------------------------------------------------------------
  // Validar y cargar
  // ------------------------------------------------------------------

  validar(): void {
    this.procesar(true);
  }

  cargar(): void {
    if (!this.yaValidado || this.cantidad('LISTO') === 0) { return; }
    this.procesar(false);
  }

  private procesar(soloValidar: boolean): void {

    if (!this.archivo || !this.usuarioActualId) { return; }

    this.loadingService.show();

    this.regSecUserService.cargarUsuariosDesdeExcel(this.archivo, {
      solicitanteUserId: this.usuarioActualId,
      codEmpresa: this.codEmpresa,
      codSucursal: this.codSucursal,
      perfil: this.perfil,
      contrasena: this.contrasena || undefined,
      soloValidar,
    }).subscribe({
      next: (res: Response) => {
        this.loadingService.hide();
        this.filas = res?.resultado || [];
        this.mensaje = res?.mensaje || '';
        this.yaValidado = true;
        this.yaCargado = !soloValidar;

        if (this.filas.length === 0) {
          this.avisar('Sin filas', 'El archivo no tiene ninguna fila con datos.');
        }
      },
      error: (err) => {
        this.loadingService.hide();
        this.avisar('No se pudo procesar',
          err?.error?.mensaje || err?.message || 'No se pudo contactar al servidor.');
      },
    });
  }

  cantidad(estado: string): number {
    return this.filas.filter(f => f.estado === estado).length;
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'CARGADO': return 'text-success fw-semibold';
      case 'LISTO':   return 'text-primary';
      case 'OMITIDO': return 'text-warning';
      default:        return 'text-danger fw-semibold';
    }
  }

  onBack(): void {
    this.location.back();
  }

  private avisar(titulo: string, mensaje: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '340px',
      data: { title: titulo, type: 'alert', message: mensaje },
    });
  }
}
