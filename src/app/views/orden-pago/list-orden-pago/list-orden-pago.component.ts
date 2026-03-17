import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  TemplateRef
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Observable, Subscription } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { OrdenPago } from '../../../models/orden-pago';
import { OrdenPagoService } from '../../../services/orden-pago.service';
import { WrapperRequestOrdenPago } from '../../../models/wrappers/wrapper-request-orden-pago';
import { Response } from '../../../models/response';
import { OcrService } from '../../../services/ocr.service';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { MessageRenderAccount } from '../../../shared/constants/messages';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { WrapperRequestVoucherItem } from '../../../models/wrappers/wrapper-request-voucher-item';
import { ConVoucherService } from '../../../services/con-voucher-item.service';
import { ConVoucherItem } from '../../../models/con-voucher.item';
import * as bootstrap from 'bootstrap';

export class Imagen {
  documentType?: string;
  documentNumber?: string;
  issuerRuc?: string;
  issuerName?: string;
  issuerAddress?: string;
  documentDate?: string;
}

@Component({
  selector: 'app-list-orden-pago',
  templateUrl: './list-orden-pago.component.html',
  styleUrls: ['./list-orden-pago.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LoadingDancingSquaresComponent,
    HasPermissionDirective
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ListOrdenPagoComponent implements OnInit, OnDestroy {

  @ViewChild('myTable') tableRef!: ElementRef;
  @ViewChild('orderDialog') orderDialog!: TemplateRef<any>;
  dialogRef!: MatDialogRef<any>;

  constructor(
    private ordenPagoService: OrdenPagoService,
    private location: Location,
    private router: Router,
    private dialog: MatDialog,
    private ocrService: OcrService,
    private loadingService: LoadingService,
    private conVoucherService: ConVoucherService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  wrapperRequestOrdenPago: WrapperRequestOrdenPago = new WrapperRequestOrdenPago();
  isAdminUser: boolean = false;
  isLoading$: Observable<boolean>;

  detailsAsiento: ConVoucherItem[] = [];
  ordenes: OrdenPago[] = [];
  ordenesGeneral: OrdenPago[] = [];
  pagedOrdenes: OrdenPago[] = [];

  filtrarOrden: string = '';

  pageSize = 6;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;

  detail: OrdenPago = new OrdenPago();
  modal: any;

  private navigationSub!: Subscription;
  imagen: Imagen = new Imagen();

  private readonly stateActions: any = {
    'EM': { read: false, add: false, info: false },
    'PE': { read: false, add: true, info: true },
    'LQ': { read: true, add: false, info: true },
    'PR': { read: false, add: false, info: false }
  };

  ngOnInit(): void {

    this.inicializarWrapperDesdeSession();
    this.cargarDesdeStateOApi();

    this.navigationSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.cargarDesdeStateOApi();
      });
  }

  ngOnDestroy(): void {
    this.navigationSub?.unsubscribe();
  }

  private inicializarWrapperDesdeSession(): void {

    const userString = sessionStorage.getItem('user');

    if (!userString) {
      return;
    }

    try {

      const user = JSON.parse(userString);
      this.isAdminUser = user.userAdmin || false;
      this.wrapperRequestOrdenPago.codAuxiliar = user.codAuxiliar || '';
      this.wrapperRequestOrdenPago.codEmpresa = user.codEmpresa || '';
      this.wrapperRequestOrdenPago.codSucursal = user.codSucursal || '';
      this.wrapperRequestOrdenPago.isAdmin = this.isAdminUser || false;

    } catch (e) {
      console.error('Error al parsear User desde sessionStorage', e);
    }
  }

  private cargarDesdeStateOApi(): void {

    const state = history.state;

    this.loadingService.show();

    if (state && state.data && state.data.resultado) {

      this.ordenes = state.data.resultado;
      this.ordenesGeneral = state.data.resultado;

      this.currentPage = 0;
      this.buildPagination();
      this.loadingService.hide();

    } else {

      this.getOrdenesPago();

    }
  }

  private buildPagination(): void {

    this.totalItems = this.ordenes.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);

    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;

    this.pagedOrdenes = this.ordenes.slice(start, end);
  }

  changePage(page: number): void {

    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.buildPagination();
  }

  getOrdenesPago(): void {
    this.ordenPagoService
      .getOrdenesPago(this.wrapperRequestOrdenPago)
      .subscribe({
        next: (response: Response) => {
          this.ordenes = response.resultado || [];
          if (this.isAdminUser == false) {
            this.ordenes = this.ordenes.filter(filtro => filtro.tipEstado == "PR" || filtro.tipEstado == "LQ")
          }
          this.ordenesGeneral = this.ordenes;
          this.currentPage = 0;
          this.buildPagination();
          this.loadingService.hide();
        },
        error: () => {
          this.loadingService.hide();
        }
      });
  }

  onBack(): void {
    this.location.back();
  }

  openModal() {
    this.dialogRef = this.dialog.open(this.orderDialog, {
      width: '90%',
      height: '90%',
      maxWidth: '90%',
      maxHeight: '90%',
      panelClass: 'custom-dialog-container',
      autoFocus: false
    });
  }

  close() {
    this.dialogRef.close();
  }

  onSelectImage(event: Event) {

    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    this.ocrService.uploadImage(file).subscribe(
      (response: any) => {
        console.log('Respuesta del OCR:', response);
        this.imagen.documentType = response.detectedData.documentType;
        this.imagen.documentNumber = response.detectedData.documentNumber;
        this.imagen.issuerRuc = response.detectedData.issuerRuc;
        this.imagen.issuerName = response.detectedData.issuerName;
        this.imagen.issuerAddress = response.detectedData.issuerAddress;
        this.imagen.documentDate = response.detectedData.documentDate;
      }
    );
  }

  openEditRendirCuenta(orden: OrdenPago) {
    const hoy = new Date();
    if (orden.fecRendicion) {

      const fechaRendicion = new Date(orden.fecRendicion);

      if (fechaRendicion.getTime() < hoy.getTime()) {
        console.log("Fecha de Rendición vencida");
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
          width: '280px',
          disableClose: true,
          data: {
            title: 'Alerta',
            message: MessageRenderAccount.FECHA_VENCIMIENTO,
            type: 'alert',
            autoClose: true,
            duration: 2000
          }
        });
      } else {
        this.router.navigate(['/edit-rendir-cuenta'], { state: { data: orden } });
      }
    }
  }

  viewOrdenesPagoDet(orden: OrdenPago) {
    this.router.navigate(['/list-orders-detail'], { state: { data: orden } });
  }

  filtrarOrdenPago() {

    const term = this.filtrarOrden.toLowerCase();

    if (term) {
      console.log("Term ", term)
      this.ordenes = this.ordenesGeneral.filter(orden => {
        return (
          (orden.codAuxiliar && orden.codAuxiliar.toLowerCase().includes(term)) ||
          (orden.cdesAuxiliar && orden.cdesAuxiliar.toLowerCase().includes(term)) ||
          (orden.numOrden && orden.numOrden.toLowerCase().includes(term)) ||
          (orden.anoPeriodo && orden.anoPeriodo.toLowerCase().includes(term)) ||
          (orden.fecOrden?.toString() && orden.fecOrden.toString().toLowerCase().includes(term)) ||
          (orden.tipEstado && orden.tipEstado.toUpperCase().includes(term.toUpperCase())) ||
          (orden.impOrdPago?.toString() && orden.impOrdPago.toString().toLowerCase().includes(term))
        );
      });

      this.currentPage = 0;
      this.buildPagination();

    } else {

      this.ordenes = this.ordenesGeneral;
      this.currentPage = 0;
      this.buildPagination();
    }
  }

  getStatusTitle(status: string): string {
    switch (status) {
      case 'EM': return 'EMITIDA';
      case 'PE': return 'PENDIENTE';
      case 'LQ': return 'LIQUIDADA';
      default: return '';
    }
  }

  isActionEnabled(state: string, action: 'read' | 'add' | 'info'): boolean {
    if (!state)
      return false;
    return this.stateActions[state]?.[action] || false;
  }

  abrirModalDoc() {
    const modalElement = document.getElementById('modalDocumento');
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement);
      this.modal.show();
    } else {
      console.error('modalDocumento element not found');
    }
  }

  cerrarModalDoc() {
    if (this.modal) {
      this.modal.hide();
    }
  }

  getAsiento(aux: OrdenPago) {
    var wrapper: WrapperRequestVoucherItem = new WrapperRequestVoucherItem();
    wrapper.anoPeriodo = aux.anoPeriodoVou;
    wrapper.codPeriodo = aux.codPeriodoVou;
    wrapper.codEmpresa = aux.codEmpresa;
    wrapper.codTipoComprobante = '06';
    wrapper.numFile = '02';
    wrapper.numVoucher = aux.numVoucher;
    this.conVoucherService.getAsiento(wrapper).subscribe(
      (response: Response) => {
        this.detailsAsiento = response.resultado;
        console.log(this.detailsAsiento);
        if (this.detailsAsiento.length > 0) {
          this.abrirModalDoc();
        }
      }
    )
  }

  getTotal(indDebeHaber: string, moneda: string): number {
    return this.detailsAsiento.reduce((total, item) => {
      return total + (item.indDebeHaber === indDebeHaber ? ((moneda == '01' ? item.impSoles : item.impDolares) || 0) : 0);
    }, 0);
  }

  onPlanillaMovilidad(orden: OrdenPago) {
    this.router.navigate(['/planilla-movilidad'], { state: { data: orden } });
  }
}
