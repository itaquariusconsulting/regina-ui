import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import moment from 'moment'
import Swal from 'sweetalert2';
import * as bootstrap from 'bootstrap';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { Observable, finalize } from 'rxjs';
import { OrdenPago } from '../../../models/orden-pago';
import { DeviceService } from '../../../services/core-service/device.service';
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
import { MaeUbigeo, TipoUbigeo } from '../../../models/mae-ubigeo';

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

  pageSizeAux = 7;
  currentPageAux = 0;
  totalItemsAux = 0;
  totalPagesAux = 0;

  pageSizeUbigeos = 7;
  currentPageUbigeos = 0;
  totalItemsUbigeos = 0;
  totalPagesUbigeos = 0;

  listaMovilidad: OrdenPagoPlanillaMovilidadDet[] = [];
  documentosGeneral: MaeDocumento[] = [];
  modelPlanillaIni: moment.Moment | null = moment();
  minDate = moment('2020-01-01');
  maxDate = moment('2030-12-31');
  modal: any;
  modalAuxiliares: any;
  modalUbigeos: any;
  nuevoDetalle: OrdenPagoPlanillaMovilidadDet = new OrdenPagoPlanillaMovilidadDet();
  nuevoDetalleFecha: string = '';
  guardandoDetalle: boolean = false;
  guardandoCabecera: boolean = false;
  auxiliaresPR: MaeAuxiliarDTO[] = [];
  auxiliarSeleccionado: MaeAuxiliarDTO | null = null;
  pagedViajesAux: MaeAuxiliarDTO[] = [];

  ubigeos: MaeUbigeo[] = [];
  ubigeosGeneral: MaeUbigeo[] = [];

  searchUbigeo: string = '';
  pagedUbigeos: MaeUbigeo[] = [];
  tipoUbigeo: number = -1;

  origenSeleccionado: MaeUbigeo | null = null;
  destinoSeleccionado: MaeUbigeo | null = null;

  ngOnInit(): void {
    this.initializeComponentData();
    this.setupUI();
    this.loadPlanillaData();
  }

  private initializeComponentData(): void {
    const { data } = history.state || {};
    if (!data) return;

    this.orden = data.orden ?? data;
    this.ordenPagoPlanillaMovilidadCab = data.planilla ?? new OrdenPagoCabPlanilla();

    if (this.orden?.fecOrden) {
      this.minDate = moment(this.orden.fecOrden);
    }
  }

  private setupUI(): void {
    this.isDesktop = this.deviceService.isDesktopDevice();
    this.buildPagination();
    this.getCentroCostos();
  }

  private loadPlanillaData(): void {
    if (this.ordenPagoPlanillaMovilidadCab?.codPlanilla) {
      this.mapHeaderData(this.ordenPagoPlanillaMovilidadCab);
      this.loadPlanillaDetails();
      return;
    }

    this.loadPlanillaHeader();
  }

  private get empresaId(): string {
    return this.orden?.codEmpresa ?? '0001';
  }

  getCentroCostos(): void {
    this.loadingService.show();
    this.maestrosService.getCentroCostos(this.empresaId, "001").subscribe({
      next: (response: Response) => {
        this.centroCostos = response.resultado;
        const foundCentro = this.centroCostos.find(cc => cc.codCCostos === this.orden.codCCostos);
        this.centro = foundCentro ?? new MaeCentroCostrosDTO();
        this.getBancos();
      },
      error: (err) => {
        console.error("No se pudo obtener la lista de Centros de Costos", err);
      }
    });
  }

  getBancos(): void {
    this.maestrosService.getBancos(this.empresaId).subscribe({
      next: (response: Response) => {
        this.bancos = response.resultado;
        this.banco = this.bancos?.[0]?.codAuxiliar ?? '';
        this.getDocumentos();
      },
      error: (err) => {
        console.error("No se pudo obtener la lista de Bancos", err);
      }
    });
  }

  getDocumentos(): void {
    this.maestrosService.getTiposDocumento(this.empresaId).subscribe({
      next: (response: Response) => {
        this.documentosGeneral = response.resultado;
        this.getUbigeos();
      },
      error: (err) => {
        console.error("No se pudo obtener la lista de Documentos", err);
      }
    });
  }

  getUbigeos(): void {
    this.maestrosService.getUbigeos()
      .subscribe({
        next: (response: Response) => {
          const { resultado } = response;
          this.ubigeos = resultado;
          this.ubigeosGeneral = resultado;
          this.currentPageUbigeos = 0;

          this.buildPaginationUbigeos();
          this.getAuxiliaresPR();
        },
        error: (err) => {
          console.error("No se pudo obtener la lista de ubigeos", err);
        }
      });
  }

  filterUbigeos(): void {
    const searchTerm = this.searchUbigeo?.toLowerCase().trim();
    if (!searchTerm) {
      this.ubigeos = [...this.ubigeosGeneral];
    } else {
      this.ubigeos = this.ubigeosGeneral.filter(u => {
        return [u.desDepartamento, u.desProvincia, u.desDistrito].some(field =>
          field?.toLowerCase().includes(searchTerm)
        );
      });
    }
    this.buildPaginationUbigeos();
  }

  selectUbigeos(ubigeo: MaeUbigeo): void {
    if (this.tipoUbigeo === TipoUbigeo.Origen) {
      this.nuevoDetalle.codOrigen = ubigeo.codUbigeo ?? '';
      this.origenSeleccionado = ubigeo;
    } else if (this.tipoUbigeo === TipoUbigeo.Destino) {
      this.nuevoDetalle.codDestino = ubigeo.codUbigeo ?? '';
      this.destinoSeleccionado = ubigeo;
    }
    this.closeUbigeosModal();
  }

  getAuxiliaresPR(): void {
    this.maestrosService.getListaAuxiliaresPR(this.empresaId).subscribe({
      next: (response: Response) => {
        this.auxiliaresPR = response.resultado;
        this.currentPageAux = 0;
        this.buildPaginationAuxiliares();
      },
      error: (err) => {
        console.error("No se pudo obtener la lista de Auxiliares PR", err);
      },
      complete: () => this.loadingService.hide()
    });
  }

  onBack(): void {
    this.location.back();
  }

  devolverDocumento(tipoDoc: string): string {
    return this.documentosGeneral
      .find(doc => doc.codDocumento == tipoDoc)
      ?.desDocumento ?? '';
  }

  mapAuxilarName(cod: string | undefined | null): string {
    if (!cod) return '';
    const aux = this.auxiliaresPR.find(x => x.codAuxiliar === cod);
    return aux ? aux.desAuxiliar! : cod;
  }

  mapUbigeoText(cod: string | undefined | null): string {
    if (!cod) return '';
    const u = this.ubigeosGeneral.find(x => x.codUbigeo === cod);
    return u ? `${u.desDepartamento}-${u.desProvincia}-${u.desDistrito}` : cod;
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

  private buildPaginationUbigeos(): void {
    this.totalItemsUbigeos = this.ubigeos.length;
    this.totalPagesUbigeos = Math.ceil(this.totalItemsUbigeos / this.pageSizeUbigeos);

    const start = this.currentPageUbigeos * this.pageSizeUbigeos;
    const end = start + this.pageSizeUbigeos;

    this.pagedUbigeos = this.ubigeos.slice(start, end);
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

  changePageUbigeos(page: number): void {
    if (page < 0 || page >= this.totalPagesUbigeos) {
      return;
    }
    this.currentPageUbigeos = page;
    this.buildPaginationUbigeos();
  }

  private getOrderParams() {
    const { codEmpresa, codSucursal, anioPeriodo, codPeriodo, numOrden, codPlanilla } = this.ordenPagoPlanillaMovilidadCab;
    return {
      codEmpresa: codEmpresa ?? '',
      codSucursal: codSucursal ?? '',
      anioPeriodo: anioPeriodo ?? '',
      codPeriodo: codPeriodo ?? '',
      numOrden: numOrden ?? '',
      codPlanilla: codPlanilla ?? ''
    };
  }

  private resetListState(): void {
    this.listaMovilidad = [];
    this.currentPage = 0;
    this.buildPagination();
  }

  private loadPlanillaDetails(): void {
    this.loadingService.show();

    const params = this.getOrderParams();
    this.planillaDetService.listarDetalle(
      params.codEmpresa,
      params.codSucursal,
      params.anioPeriodo,
      params.codPeriodo,
      params.numOrden,
      params.codPlanilla
    ).pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (response: any) => {
          this.listaMovilidad = response.resultado || [];
          console.log("Lista de detalles de movilidad: ", this.listaMovilidad);
          this.currentPage = 0;
          this.buildPagination();
        },
        error: () => this.resetListState()
      });
  }

  private loadPlanillaHeader(): void {
    this.loadingService.show();
    const params = this.getOrderParams();

    if (Object.values(params).some(val => !val)) return;

    const wrapper: WrapperRequestPlanillaMovilidadCab = { ...params };
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
    cab.codPlanilla = data.codPlanilla;
    cab.maxNumViajes = data.maxNumViajes;
    cab.total = data.total;
    cab.glosa = data.glosa;

    const fecha = data.fechaPlanilla;
    if (fecha) {
      this.modelPlanillaIni = moment(fecha);
    }
  }

  openDetailModal(): void {
    this.nuevoDetalle = new OrdenPagoPlanillaMovilidadDet();
    this.nuevoDetalleFecha = new Date().toISOString().slice(0, 10);

    Object.assign(this.nuevoDetalle, this.getOrderParams(), {
      codPlanilla: this.ordenPagoPlanillaMovilidadCab.codPlanilla ?? ''
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

  selectAuxiliar(auxiliar: MaeAuxiliarDTO): void {
    this.auxiliarSeleccionado = auxiliar;
    this.nuevoDetalle.codAuxiliarProveedor = auxiliar.codAuxiliar ?? '';
    this.closeAuxiliaresModal();
  }

  openUbigeosModal(tipoUbigeo: number): void {
    this.tipoUbigeo = tipoUbigeo;
    const modalElement = document.getElementById('modalUbigeos');
    if (modalElement) {
      this.modalUbigeos = new bootstrap.Modal(modalElement);
      this.modalUbigeos.show();
    }
  }

  closeUbigeosModal(): void {
    this.modalUbigeos?.hide();
  }

  saveDetails(): void {
    if (this.guardandoDetalle || !this.nuevoDetalleFecha) return;

    const codPlanilla = this.ordenPagoPlanillaMovilidadCab.codPlanilla ?? '';
    const commonSwalConfig: any = {
      toast: true, position: 'top-end', showConfirmButton: false,
      timer: 3000, timerProgressBar: true
    };

    if (!codPlanilla) {
      Swal.fire({
        ...commonSwalConfig,
        icon: 'warning',
        title: 'Debe guardar la planilla antes de agregar detalles.'
      });
      return;
    }

    const importeNuevo = Number(this.nuevoDetalle.importe ?? 0);
    const totalCabecera = Number(this.ordenPagoPlanillaMovilidadCab.total ?? 0);
    const totalActual = this.getTotalImporteDetalles();

    if (totalCabecera > 0 && (totalActual + importeNuevo) > totalCabecera) {
      Swal.fire({
        ...commonSwalConfig,
        icon: 'warning',
        title: 'La suma de los importes supera el total permitido en la cabecera.'
      });
      return;
    }

    const maxViajes = Number(this.ordenPagoPlanillaMovilidadCab.maxNumViajes ?? 0);
    if (maxViajes > 0 && (this.listaMovilidad.length + 1) > maxViajes) {
      Swal.fire({
        ...commonSwalConfig,
        icon: 'warning',
        title: 'Has alcanzado el número máximo de viajes permitido en la cabecera.'
      });
      return;
    }

    this.loadingService.show();
    this.guardandoDetalle = true;

    const commonParams = this.getOrderParams();
    const detalleInsertado: OrdenPagoPlanillaMovilidadDet = {
      ...this.nuevoDetalle,
      ...commonParams,
      codPlanilla,
      fecItemPlanilla: new Date(this.nuevoDetalleFecha)
    };

    this.planillaDetService.insertarDetalle(detalleInsertado)
      .pipe(finalize(() => this.finalizeSave()))
      .subscribe({
        next: (response: any) => {
          if (response?.error === 0) {
            detalleInsertado.numItemPlanilla = response.resultado;
            this.listaMovilidad = [detalleInsertado, ...this.listaMovilidad];
            this.currentPage = 0;
            this.buildPagination();
            this.closeDetailModal();
            Swal.fire({
              ...commonSwalConfig,
              icon: 'success',
              title: '¡Registro Exitoso!',
              text: 'El detalle de la planilla ha sido guardado correctamente.',
            });
          } else {
            Swal.fire({
              ...commonSwalConfig,
              icon: 'error',
              title: response?.mensaje || 'No se pudo insertar el detalle.'
            });
          }
        },
        error: () => {
          Swal.fire({
            ...commonSwalConfig,
            icon: 'error',
            title: 'No se pudo insertar el detalle.'
          });
        }
      });
  }

  savePlanilla(): void {
    if (this.guardandoCabecera || !this.modelPlanillaIni) return;

    this.loadingService.show();
    this.guardandoCabecera = true;

    const currentCodPlanilla = this.ordenPagoPlanillaMovilidadCab.codPlanilla;

    const dto: OrdenPagoCabPlanilla = {
      ...this.getOrderParams(),
      codPlanilla: currentCodPlanilla,
      fechaPlanilla: moment(this.modelPlanillaIni).toDate(),
      maxNumViajes: this.ordenPagoPlanillaMovilidadCab.maxNumViajes,
      total: this.ordenPagoPlanillaMovilidadCab.total,
      glosa: this.ordenPagoPlanillaMovilidadCab.glosa,
      codAuxiliarBanco: '',
      codAuxiliarPersonal: '',
      cCentroCostos: '',
      monto: 0,
      recibido: 0,
      devolucion: 0,
      statusPlanilla: 'PE'
    };

    const request$ = currentCodPlanilla
      ? this.planillaCabService.updatePlanillaMovilidad(dto)
      : this.planillaCabService.savePlanillaMovilidad(dto);

    request$
      .pipe(finalize(() => this.finalizeSave()))
      .subscribe({
        next: (response) => {
          if (response?.error !== 0) {
            console.error("Error en servidor:", response?.mensaje);
          }
          if (!currentCodPlanilla && response.resultado) {
            this.ordenPagoPlanillaMovilidadCab.codPlanilla = response.resultado;
          }
        },
        error: (err) => console.error("Error de conexión:", err)
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

  isGuardarDisabled(): boolean {
    return !this.modelPlanillaIni
      || !this.ordenPagoPlanillaMovilidadCab.total
      || !this.ordenPagoPlanillaMovilidadCab.maxNumViajes
      || !this.ordenPagoPlanillaMovilidadCab.glosa;
  }

  isFormInvalid(): boolean {
    return (
      !this.nuevoDetalleFecha ||
      !this.nuevoDetalle.codDocumento ||
      !this.nuevoDetalle.serDocumento?.trim() ||
      !this.nuevoDetalle.numDocumento?.trim() ||
      !this.nuevoDetalle.codAuxiliarProveedor ||
      !this.nuevoDetalle.glosa?.trim() ||
      !this.nuevoDetalle.importe || this.nuevoDetalle.importe <= 0 ||
      !this.nuevoDetalle.cantPersonas ||
      !this.nuevoDetalle.codOrigen ||
      !this.nuevoDetalle.codDestino
    );
  }
}
