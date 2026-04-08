import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import moment from 'moment'
import Swal from 'sweetalert2';
import * as bootstrap from 'bootstrap';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { Observable, finalize, forkJoin } from 'rxjs';
import { OrdenPago } from '../../../models/orden-pago';
import { DeviceService } from '../../../services/core-service/device.service';
import { PadronRuc } from '../../../models/padron-ruc';
import { Response } from '../../../models/response';
import { MaeCentroCostrosDTO } from '../../../models/mae-centro-costos';
import { MaestrosService } from '../../../services/maestros.service';
import { MaeBanco } from '../../../models/mae-banco';
import { OrdenPagoCabPlanilla } from '../../../models/orden-pago-planilla-movilidad-cab';
import { NgxCurrencyDirective } from 'ngx-currency';
import { OrdenPagoPlanillaMovilidadDet } from '../../../models/orden-pago-planilla-movilidad-det';
import { MaeDocumento } from '../../../models/mae-documento';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import { OrdenPagoPlanillaMovilidadDetService } from '../../../services/orden-pago-planilla-movilidad-det.service';
import { OrdenPagoPlanillaMovilidadCabService } from '../../../services/orden-pago-planilla-movilidad-cab.service';
import { WrapperRequestPlanillaMovilidadCab } from '../../../models/wrappers/wrapper-request-planilla-movilidad-cab';
import { MaeAuxiliarDTO } from '../../../models/mae-auxiliar-dto';

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
  constructor(
    private location: Location,
    private deviceService: DeviceService,
    private loadingService: LoadingService,
    private maestrosService: MaestrosService,
    private planillaDetService: OrdenPagoPlanillaMovilidadDetService,
    private planillaCabService: OrdenPagoPlanillaMovilidadCabService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  isLoading$: Observable<boolean>;
  orden: OrdenPago = new OrdenPago();
  isDesktop: boolean = false;
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


  pageSizeAux = 10;
  currentPageAux = 0;
  totalItemsAux = 0;
  totalPagesAux = 0;

  listaMovilidad: OrdenPagoPlanillaMovilidadDet[] = [];
  documentosGeneral: MaeDocumento[] = [];
  newDate: Date = new Date();
  modelPlanillaIni: moment.Moment | null = moment();
  minDate = moment('2020-01-01');
  maxDate = moment('2030-12-31');
  modal: any;
  modalAuxiliares: any;
  nuevoDetalle: OrdenPagoPlanillaMovilidadDet = new OrdenPagoPlanillaMovilidadDet();
  nuevoDetalleFecha: string = '';
  guardandoDetalle: boolean = false;
  guardandoCabecera: boolean = false;
  auxiliaresPR: MaeAuxiliarDTO[] = [];
  auxiliarSeleccionado: MaeAuxiliarDTO | null = null;
  pagedViajesAux: MaeAuxiliarDTO[] = [];

  ngOnInit(): void {
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data;
      this.minDate = moment(this.orden.fecOrden);
    }
    this.isDesktop = this.deviceService.isDesktopDevice();
    this.buildPagination();
    this.getCentroCostos();
    this.loadPlanillaHeader();
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
        this.getDocumentos();
      },
      (error) => {
        console.log("No se pudo obtener la lista de bancos");
        this.loadingService.hide();
      }
    )
  }

  getDocumentos() {
    this.maestrosService.getTiposDocumento(this.orden.codEmpresa ?? '0001').subscribe(
      (response: Response) => {
        this.documentosGeneral = response.resultado;
        this.getAuxiliaresPR();
      },
      (error) => {
        console.log("No se pudo obtener la lista de documentos");
        this.loadingService.hide();
      }
    );
  }

  getAuxiliaresPR() {
    this.maestrosService.getListaAuxiliaresPR(this.orden.codEmpresa ?? '0001').subscribe(
      (response: Response) => {
        this.auxiliaresPR = response.resultado;
        this.currentPageAux = 0;
        this.buildPaginationAuxiliares();
        this.loadingService.hide();
      },
      (error) => {
        console.log("No se pudo obtener la lista de auxiliares PR");
        this.loadingService.hide();
      }
    );
  }

  onBack(): void {
    this.location.back();
  }

  devolverDocumento(tipoDoc: string): string {
    return this.documentosGeneral
      .find(doc => doc.codDocumento == tipoDoc)
      ?.desDocumento ?? '';
  }

  private buildPagination(): void {
    this.totalItems = this.listaMovilidad.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);

    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;

    this.pagedViajes = this.listaMovilidad.slice(start, end);
  }

    private buildPaginationAuxiliares(): void {
    this.totalItemsAux = this.auxiliaresPR.length;
    this.totalPagesAux = Math.ceil(this.totalItemsAux / this.pageSizeAux);

    const start = this.currentPageAux * this.pageSizeAux;
    const end = start + this.pageSizeAux;

    this.pagedViajesAux = this.auxiliaresPR.slice(start, end);
  }

  changePage(page: number): void {
    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.buildPagination();
  }

  changePageAuxiliares(page: number): void {
    if (page < 0 || page >= this.totalPagesAux) {
      return;
    }

    this.currentPageAux = page;
    this.buildPaginationAuxiliares();
  }

  private getOrderParams() {
    const { codEmpresa, codSucursal, anoPeriodo, codPeriodo, numOrden } = this.orden;
    return {
      codEmpresa: codEmpresa ?? '',
      codSucursal: codSucursal ?? '',
      anioPeriodo: anoPeriodo ?? '',
      codPeriodo: codPeriodo ?? '',
      numOrden: numOrden ?? ''
    };
  }

  private resetListState(): void {
    this.listaMovilidad = [];
    this.currentPage = 0;
    this.buildPagination();
  }

  private loadPlanillaDetails(): void {
    const params = this.getOrderParams();
    const codPlanilla = this.ordenPagoPlanillaMovilidadCab.numPlanilla ?? '';

    if (Object.values(params).some(val => !val) || !codPlanilla) {
      this.resetListState();
      return;
    }

    this.loadingService.show();
    this.planillaDetService.listarDetalle(
      params.codEmpresa,
      params.codSucursal,
      params.anioPeriodo,
      params.codPeriodo,
      params.numOrden,
      codPlanilla
    )
      .pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (response: any) => {
          this.listaMovilidad = response.resultado || [];
          this.currentPage = 0;
          this.buildPagination();
        },
        error: () => this.resetListState()
      });
  }

  private loadPlanillaHeader(): void {
    const params = this.getOrderParams();

    if (Object.values(params).some(val => !val)) return;

    const wrapper: WrapperRequestPlanillaMovilidadCab = { ...params };

    this.loadingService.show();
    this.planillaCabService.getPlanillaMovilidad(wrapper)
      .pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (response: any) => {
          const planillas = response.resultado || [];
          if (planillas.length > 0) {
            const lastPlanilla = planillas[planillas.length - 1];
            this.mapHeaderData(lastPlanilla);
            this.loadPlanillaDetails();
          } else {
            this.resetListState();
          }
        }
      });
  }

  private mapHeaderData(data: any): void {
    const cab = this.ordenPagoPlanillaMovilidadCab;
    cab.numPlanilla = data.codPlanilla;
    cab.numMaxViajes = data.maxNumViajes;
    cab.amountPlanilla = data.total;
    cab.glosaPlanilla = data.glosa;

    const fecha = data.fechaPlanilla ?? data.fecPlanilla;
    if (fecha) {
      this.modelPlanillaIni = moment(fecha);
    }
  }

  openDetailModal(): void {
    this.nuevoDetalle = new OrdenPagoPlanillaMovilidadDet();
    this.nuevoDetalleFecha = new Date().toISOString().slice(0, 10);

    Object.assign(this.nuevoDetalle, this.getOrderParams(), {
      codPlanilla: this.ordenPagoPlanillaMovilidadCab.numPlanilla ?? ''
    });

    const modalElement = document.getElementById('modalNuevoDetalle');
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement);
      this.modal.show();
    }
  }

  closeDetailModal(): void {
    this.modal?.hide();
  }

  openAuxiliaresModal(): void {
    const modalElement = document.getElementById('modalAuxiliares');
    if (modalElement) {
      this.modalAuxiliares = new bootstrap.Modal(modalElement);
      this.modalAuxiliares.show();
    }
  }

  closeAuxiliaresModal(): void {
    this.modalAuxiliares?.hide();
  }

  appendDetails(): void {
    if (this.guardandoDetalle) return;

    if (!this.nuevoDetalleFecha) return;

    const importeNuevo = Number(this.nuevoDetalle.importe ?? 0);
    const totalCabecera = Number(this.ordenPagoPlanillaMovilidadCab.amountPlanilla ?? 0);
    const totalActual = this.getTotalImporteDetalles();

    if (totalCabecera > 0 && (totalActual + importeNuevo) > totalCabecera) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'La suma de los importes supera el total permitido en la cabecera.',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
      return;
    }

    const maxViajes = Number(this.ordenPagoPlanillaMovilidadCab.numMaxViajes ?? 0);
    if (maxViajes > 0 && (this.listaMovilidad.length + 1) > maxViajes) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Has alcanzado el número máximo de viajes permitido en la cabecera.',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
      return;
    }

    const detalleInsertado: OrdenPagoPlanillaMovilidadDet = {
      ...this.nuevoDetalle,
      fecItemPlanilla: new Date(this.nuevoDetalleFecha)
    };

    this.listaMovilidad = [detalleInsertado, ...this.listaMovilidad];
    this.currentPage = 0;
    this.buildPagination();
    this.closeDetailModal();
  }

  savePlanilla(): void {
    if (this.guardandoCabecera) return;

    if (!this.modelPlanillaIni) return;

    this.guardandoCabecera = true;
    this.loadingService.show();

    const dto = {
      ...this.getOrderParams(),
      fechaPlanilla: moment(this.modelPlanillaIni).format('YYYY-MM-DD'),
      maxNumViajes: this.ordenPagoPlanillaMovilidadCab.numMaxViajes,
      total: this.ordenPagoPlanillaMovilidadCab.amountPlanilla,
      glosa: this.ordenPagoPlanillaMovilidadCab.glosaPlanilla
    };

    this.planillaCabService.savePlanillaMovilidad(dto)
      .subscribe({
        next: (response: any) => {
          if (response?.error === 0) {
            this.saveDetails(response.resultado);
          } else {
            this.finalizeSave();
          }
        },
        error: () => {
          this.finalizeSave();
        }
      });
  }

  private saveDetails(codPlanilla: string): void {
    if (this.listaMovilidad.length === 0) {
      this.finalizeSave();
      return;
    }

    const commonParams = this.getOrderParams();
    const requests = this.listaMovilidad.map(det => {
      const dto: OrdenPagoPlanillaMovilidadDet = {
        ...det,
        ...commonParams,
        codPlanilla
      };
      return this.planillaDetService.insertarDetalle(dto);
    });

    forkJoin(requests)
      .pipe(finalize(() => this.finalizeSave()))
      .subscribe({
        error: (err) => (console.error('Error al guardar detalles:', err))
      });
  }

  private finalizeSave(): void {
    this.loadingService.hide();
    this.guardandoCabecera = false;
    this.guardandoDetalle = false;
  }

  private getTotalImporteDetalles(): number {
    return this.listaMovilidad.reduce((sum, d) => sum + Number(d.importe ?? 0), 0);
  }
}
