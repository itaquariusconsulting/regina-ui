import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeKey, ThemeService } from '../../shared/services/theme.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SettingsComponent implements OnInit {

  constructor(private themeService: ThemeService) {}

  selectedTheme: ThemeKey | null = null;

  ngOnInit(): void {
    const theme = this.themeService.getStoredTheme();
    if (theme) {
      this.selectedTheme = theme;
      this.themeService.applyTheme(theme);
    }
  }

  changeTheme(theme: ThemeKey): void {
    this.selectedTheme = theme;
    this.themeService.setTheme(theme);
  }
}
