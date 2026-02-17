import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegSecUser } from '../../../models/reg-sec-user';
import { RegSecUserService } from '../../../services/reg-sec-user.service';
import { WrapperRequestUsuario } from '../../../models/wrappers/wrapper-request-usuario';
import { Response } from '../../../models/response';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { RegRenValidate } from '../../../models/reg-ren-validate';

@Component({
  selector: 'app-list-validaciones',
  imports: [CommonModule, FormsModule],
  templateUrl: './list-validaciones.component.html',
  styleUrl: './list-validaciones.component.scss'
})
export class ListValidacionesComponent {
  constructor(private regRenValidateService: RegRenValidateService, private location: Location,
    private router: Router,
    private dialog: MatDialog
  ) { }

  @ViewChild('myTable', { static: true }) tableRef!: ElementRef;

  validaciones: RegRenValidate[] = [];
  codEmpresa: string = "";
  codSucursal: string = "";

  ngOnInit(): void {
    const userString = sessionStorage.getItem('user');
    const state = history.state;

    if (userString) {
      try {
        const user = JSON.parse(userString);
        this.codEmpresa = user.codEmpresa || '';
        this.codSucursal = user.codSucursal || '';
        if (state.data) {
          this.validaciones = state.data.resultado;
        } else {
          this.getValidaciones();
        }
      } catch (e) {
        console.error('Error al parsear User desde sessionStorage', e);
      }
    }
  }

  getValidaciones() {
    this.regRenValidateService.getRegRenValidateRules().subscribe(
      (response: Response) => {
        this.validaciones = response.resultado || [];
      }
    );
  }

  onBack() {
    this.location.back();
  }

  onNewValidacion() {
    console.log("Nueva Regla");
    this.router.navigate(['/edit-validacion']);
  }
}
