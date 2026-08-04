import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DeviceService } from './services/core-service/device.service';
import { ThemeService } from './shared/services/theme.service';
import { ActualizacionAppService } from './services/actualizacion-app.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppComponent implements OnInit {

  constructor(
    public deviceService: DeviceService,
    private themeService: ThemeService,
    private actualizacionApp: ActualizacionAppService
  ) {}

  ngOnInit(): void {
    // Vigila si se publico una version nueva y ofrece recargar. Sin esto,
    // el service worker sirve el bundle viejo hasta que el usuario cierre
    // todas las pestanas de REGINA.
    this.actualizacionApp.iniciar();

    const theme = this.themeService.getStoredTheme();

    if (theme) {
      this.themeService.applyTheme(theme);
    }
  }

  title = 'Rendición de Cuentas';

}
