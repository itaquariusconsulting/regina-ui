import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { Observable } from 'rxjs';
import { OrdenPago } from '../../../models/orden-pago';
import { DeviceService } from '../../../services/core-service/device.service';
import { RucInput } from '../../../shared/constants/validation-constants';
import { SunatService } from '../../../services/sunat-service';
import { PadronRuc } from '../../../models/padron-ruc';
import { HttpErrorResponse } from '@angular/common/http';
import { Response } from '../../../models/response';
import { MaeCentroCostrosDTO } from '../../../models/mae-centro-costos';
import { MaestrosService } from '../../../services/maestros.service';
import { MaeBanco } from '../../../models/mae-banco';
import { OrdenPagoCabPlanilla } from '../../../models/orden-pago-planilla-movilidad-cab';
import { NgxCurrencyDirective } from 'ngx-currency';
import { OrdenPagoPlanillaMovilidadDet } from '../../../models/orden-pago-planilla-movilidad-det';
import { MOCK_PLANILLA_MOVILIDAD } from '../planilla-movilidad/planilla-movilidad-mock';
import { MaeDocumento } from '../../../models/mae-documento';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import moment from 'moment'
@Component({
  selector: 'app-edit-planilla-movilidad',
  providers: [
    provideMomentDateAdapter({
      parse: {
        dateInput: 'DD/MM/YYYY',
      },
      display: {
        dateInput: 'DD/MM/YYYY',
        monthYearLabel: 'MMM YYYY',
        dateA11yLabel: 'DD/MM/YYYY',
        monthYearA11yLabel: 'MMMM YYYY',
      },
    }),
    { provide: MAT_DATE_LOCALE, useValue: 'es' }
  ],
  imports: [CommonModule, FormsModule, MatDatepickerModule,
    MatInputModule,
    MatFormFieldModule,
    LoadingDancingSquaresComponent,
    NgxCurrencyDirective],
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
  pagedViajes: OrdenPagoPlanillaMovilidadDet[] = [];
  pageSize = 4;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;

  listaMovilidad: OrdenPagoPlanillaMovilidadDet[] = MOCK_PLANILLA_MOVILIDAD;
  documentosGeneral: MaeDocumento[] = [];
  newDate: Date = new Date();
  //modelPlanillaIni: NgbDateStruct = { year: this.newDate.getFullYear(), month: this.newDate.getMonth() + 1, day: this.newDate.getDate() };
  modelPlanillaIni: moment.Moment | null = moment();
  minDate = moment('2020-01-01');
  maxDate = moment('2030-12-31');
  ngOnInit(): void {
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data;
      this.minDate = moment(this.orden.fecOrden);
    }
    this.isDesktop = this.deviceService.isDesktopDevice();
    this.buildPagination();
    this.getCentroCostos();
  }

  formatDate(date: Date | null): string {
    if (!date) return '';

    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  onDateChange(event: any) {
    this.modelPlanillaIni = event.value;
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


  devolverDocumento(tipoDoc: string): string {
    return this.documentosGeneral
      .find(doc => doc.codDocumento == tipoDoc)
      ?.desDocumento ?? '';
  }

  changeDate() {

  }


  private buildPagination(): void {

    this.totalItems = this.listaMovilidad.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);

    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;

    this.pagedViajes = this.listaMovilidad.slice(start, end);
  }

  changePage(page: number): void {

    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.buildPagination();
  }
}
