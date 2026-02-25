import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { Response } from '../../../models/response';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { RegRenValidate } from '../../../models/reg-ren-validate';

@Component({
  selector: 'app-list-validaciones',
  imports: [CommonModule, FormsModule],
  templateUrl: './list-validaciones.component.html',
  styleUrl: './list-validaciones.component.scss'
})
export class ListValidacionesComponent implements OnInit {
  constructor(private regRenValidateService: RegRenValidateService,
    private location: Location,
    private router: Router,
    private dialog: MatDialog
  ) { }

  @ViewChild('myTable', { static: true }) tableRef!: ElementRef;

  validaciones: RegRenValidate[] = [];
  codEmpresa: string = "";
  codSucursal: string = "";

  ngOnInit(): void {
    this.loadUserFromSession();
    this.loadStateOrFetch();
  }

  private loadUserFromSession(): void {
    const userString = sessionStorage.getItem('user');
    if (!userString) return;

    try {
      const user = JSON.parse(userString);
      this.codEmpresa = user.codEmpresa ?? '';
      this.codSucursal = user.codSucursal ?? '';
    } catch (error) {
      console.error('Error parsing user from sessionStorage', error);
    }
  }

  private loadStateOrFetch(): void {
    const navigationState = history.state;

    if (navigationState?.data?.resultado) {
      this.validaciones = navigationState.data.resultado;
      return;
    }

    this.getValidaciones();
  }

  private getValidaciones(): void {
    this.regRenValidateService.getRegRenValidateRules()
      .subscribe({
        next: (response: Response) => {
          this.validaciones = response?.resultado ?? [];
        },
        error: (error) => {
          console.error('Error fetching validaciones', error);
          this.validaciones = [];
        }
      });
  }

  onBack() {
    this.location.back();
  }

  onNewValidacion() {
    this.router.navigate(['/edit-validacion']);
  }
}
