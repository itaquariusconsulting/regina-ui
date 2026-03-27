import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DeviceService } from './services/core-service/device.service';
import { ThemeService } from './shared/services/theme.service';

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
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    const theme = this.themeService.getStoredTheme();

    if (theme) {
      this.themeService.applyTheme(theme);
    }
  }

  title = 'Rendición de Cuentas';

}
