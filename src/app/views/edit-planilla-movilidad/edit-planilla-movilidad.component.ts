import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../components/loading-dancing-squares/loading-dancing-squares.component';
import { Observable } from 'rxjs';
import { OrdenPago } from '../../models/orden-pago';
import { DeviceService } from '../../services/core-service/device.service';
import { RucInput } from '../../shared/constants/validation-constants';
import { SunatService } from '../../services/sunat-service';
import { PadronRuc } from '../../models/padron-ruc';
import { HttpErrorResponse } from '@angular/common/http';
import { Response } from '../../models/response';
import { MaeCentroCostrosDTO } from '../../models/mae-centro-costos';
import { MaestrosService } from '../../services/maestros.service';
import { MaeBanco } from '../../models/mae-banco';
import { OrdenPagoCabPlanilla } from '../../models/orden-pago-planilla-movilidad-cab';
import { NgxCurrencyDirective } from 'ngx-currency';

@Component({
  selector: 'app-edit-planilla-movilidad',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent, NgxCurrencyDirective],
  templateUrl: './edit-planilla-movilidad.component.html',
  styleUrl: './edit-planilla-movilidad.component.scss'
})
export class EditPlanillaMovilidadComponent implements OnInit {
  constructor(private loadingService: LoadingService,
    private deviceService: DeviceService, private location: Location,
    private sunatService: SunatService, private maestrosService: MaestrosService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  isLoading$: Observable<boolean>;
  orden: OrdenPago = new OrdenPago();
  isDesktop: boolean = false;
  ruc: string = "";
  mensaje: string = "";
  validate: boolean = false;
  padronRuc: PadronRuc = new PadronRuc();
  centroCostos: MaeCentroCostrosDTO[] = [];
  centro: MaeCentroCostrosDTO = new MaeCentroCostrosDTO();
  bancos: MaeBanco[] = [];
  banco: string = "";
  ordenPagoPlanillaMovilidadCab: OrdenPagoCabPlanilla = new OrdenPagoCabPlanilla();

  ngOnInit(): void {
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data;
    }
    this.isDesktop = this.deviceService.isDesktopDevice();

    this.getCentroCostos();
  }


  getCentroCostos() {
    this.loadingService.show();
    console.log(this.orden.codCCostos);
    this.maestrosService.getCentroCostos(this.orden.codEmpresa ?? '0001', "001").subscribe(
      (response: Response) => {
        this.centroCostos = response.resultado;
        const foundCentro = this.centroCostos.find(cc => cc.codCCostos == this.orden.codCCostos);
        this.centro = foundCentro ? foundCentro : new MaeCentroCostrosDTO();
        this.getBancos();
      },
      (error) => {
        console.log("No se pudo obtener la lista de Centros de Costos");
        this.loadingService.hide();
      }
    )
  }

  getBancos() {
    this.maestrosService.getBancos(this.orden.codEmpresa ?? '0001').subscribe(
      (response: Response) => {
        this.bancos = response.resultado;
        this.banco = this.bancos[0].codAuxiliar ?? '';
        this.loadingService.hide();
      },
      (error) => {
        console.log("No se pudo obtener la lista de bancos");
        this.loadingService.hide();
      }
    )
  }

  onBack(): void {
    this.location.back();
  }

  ruccompleto(): void {
    if (this.ruc.length !== RucInput.LENGTH) {
      this.mensaje = 'El RUC debe contener 11 dígitos.';
      this.validate = false;
      return;
    }

    this.onGetDatosRuc();
  }

  onGetDatosRuc(): void {
    this.sunatService.getDataRUC(this.ruc).subscribe({
      next: (response: Response) => this.handleRucResponse(response),
      error: (err) => this.handleRucError(err)
    });
  }

  private handleRucResponse(response: Response): void {
    if (!response || response.error !== 0) {
      this.validate = false;
      return;
    }
    this.padronRuc = response.resultado;
    this.mensaje = '';
    this.validate = true;
  }


  private handleRucError(error?: HttpErrorResponse): void {
    let message = error?.error.mensaje
      || 'No se pudo consultar SUNAT. Intente nuevamente.';

    console.log("Error al obtener RUC);")

    this.validate = false;
    this.mensaje = message;
  }

}
