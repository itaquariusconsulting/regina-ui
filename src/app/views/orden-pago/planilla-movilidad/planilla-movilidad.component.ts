import { Component, OnInit } from '@angular/core';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs/internal/Observable';
import { LoadingService } from '../../../services/loading.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { OrdenPago } from '../../../models/orden-pago';
import { Response } from '../../../models/response';
import { OrdenPagoDetDTO } from '../../../models/orden-pago-det';
import { DeviceService } from '../../../services/core-service/device.service';
import { OrdenPagoDetService } from '../../../services/orden-pago-det.service';
import { OrdenPagoPlanillaMovilidadCabService } from '../../../services/orden-pago-planilla-movilidad-cab.service';
import { OrdenPagoPlanillaMovilidadDetService } from '../../../services/orden-pago-planilla-movilidad-det.service';
import { WrapperRequestPlanillaMovilidadCab } from '../../../models/wrappers/wrapper-request-planilla-movilidad-cab';
import { Router } from '@angular/router';
import { MaeDocumento } from '../../../models/mae-documento';
import { OrdenPagoCabPlanilla, ViewMode } from '../../../models/orden-pago-planilla-movilidad-cab';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { HttpStatusCode } from '@angular/common/http';

@Component({
  selector: 'app-planilla-movilidad',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './planilla-movilidad.component.html',
  styleUrl: './planilla-movilidad.component.scss'
})
export class PlanillaMovilidadComponent implements OnInit {

  constructor(
    private location: Location,
    private loadingService: LoadingService,
    private planillaService: OrdenPagoPlanillaMovilidadCabService,
    private planillaDetService: OrdenPagoPlanillaMovilidadDetService,
    private ordenPagoDetService: OrdenPagoDetService,
    private deviceService: DeviceService,
    private router: Router,
    private dialog: MatDialog,
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  codEmpresa: string = sessionStorage.getItem("codempresa") ?? '';
  isLoading$: Observable<boolean>;

  codAuxiliar: string = '';

  orden: OrdenPago = new OrdenPago();
  planillas: OrdenPagoCabPlanilla[] = [];
  planilla: OrdenPagoCabPlanilla = new OrdenPagoCabPlanilla();
  pageSize = 6;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;

  isDesktop: boolean = false;

  documentosGeneral: MaeDocumento[] = [];

  public ViewMode = ViewMode;

  static createDefault(orden: any): OrdenPagoCabPlanilla {
    const item = new OrdenPagoCabPlanilla();
    item.codEmpresa = orden.codEmpresa;
    item.codSucursal = orden.codSucursal;
    item.anioPeriodo = orden.anoPeriodo;
    item.codPeriodo = orden.codPeriodo;
    item.numOrden = orden.numOrden;
    item.cCentroCostos = orden.codCCostos;
    item.total = 0;
    item.recibido = 0;
    item.devolucion = 0;
    item.maxNumViajes = 0;
    item.glosa = '';
    item.statusPlanilla = 'PE';
    item.fechaPlanilla = new Date();
    item.codAuxiliarBanco = '';
    item.codAuxiliarPersonal = '';
    item.codPlanilla = '';
    item.monto = 0;
    return item;
  }

  ngOnInit(): void {
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data.orden;
    }
    this.isDesktop = this.deviceService.isDesktopDevice();
    const user = sessionStorage.getItem('user')
      ? JSON.parse(sessionStorage.getItem('user')!)
      : null;
    this.codEmpresa = user?.codEmpresa || '';
    this.codAuxiliar = user?.codAuxiliar || '';

    this.getPlanillaMovilidad();

  }
  
  devolverDocumento(tipoDoc: string): string {
    return this.documentosGeneral
      .find(doc => doc.codDocumento == tipoDoc)
      ?.desDocumento ?? '';
  }

  getPlanillaMovilidad() {
    this.loadingService.show();
    let wrapper: WrapperRequestPlanillaMovilidadCab = new WrapperRequestPlanillaMovilidadCab();
    wrapper.anioPeriodo = this.orden.anoPeriodo;
    wrapper.codPeriodo = this.orden.codPeriodo;
    wrapper.codEmpresa = this.orden.codEmpresa;
    wrapper.codSucursal = this.orden.codSucursal;
    wrapper.numOrden = this.orden.numOrden;
    this.planillaService.getPlanillaMovilidad(wrapper).subscribe(
      (response: Response) => {
        this.planillas = response.resultado;
        console.log("Planillas : ", this.planillas)
        this.loadingService.hide();
      },
      (error) => {
        console.log("No se pudieron obtener las planillas");
        this.loadingService.hide();
      }
    )
  }

  onBack(): void {
    this.location.back();
  }

  private buildPagination(): void {
    /* 
        this.totalItems = this.ordenes.length;
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    
        const start = this.currentPage * this.pageSize;
        const end = start + this.pageSize;
    
        this.pagedOrdenes = this.ordenes.slice(start, end); */
  }

  changePage(page: number): void {

    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.buildPagination();
  }

  generarPanillaMovilidadPDF() {

    const DATA: any = document.getElementById('reporte');

    html2canvas(DATA).then(canvas => {

      const imgWidth = 210; // A4 mm
      const pageHeight = 295;
      const imgHeight = canvas.height * imgWidth / canvas.width;

      const contentDataURL = canvas.toDataURL('image/png');

      const pdf = new jsPDF('l', 'mm', 'a4');

      pdf.addImage(contentDataURL, 'PNG', 0, 0, imgWidth, imgHeight);

      pdf.save('reporte.pdf');

    });
  }

  onEditPlanillaMovilidad(planilla: OrdenPagoCabPlanilla, mode: ViewMode): void {
    const dataToPass = (mode === ViewMode.New)
      ? PlanillaMovilidadComponent.createDefault(this.orden)
      : planilla;

    this.router.navigate(['/edit-planilla-movilidad'], {
      state: { data: { orden: this.orden, planilla: dataToPass } }
    });
  }

  onDeletePlanillaMovilidad(planilla: OrdenPagoCabPlanilla): void {
    if (!planilla.codPlanilla) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Confirmar Eliminación',
        message: `¿Estás seguro de que deseas eliminar la planilla ${planilla.codPlanilla}?`,
        type: 'confirm'
      }
    }).afterClosed().subscribe(result => {
      if (!result) return;

      this.loadingService.show();
      this.planillaService.deletePlanillaMovilidad(planilla.codPlanilla!).subscribe({
        next: (res: Response) => {
          this.loadingService.hide();
          if (res.error === 0) {
            this.planillas = this.planillas.filter(p => p.codPlanilla !== planilla.codPlanilla);
            Swal.fire({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
              icon: 'success',
              title: '¡Eliminado!',
              text: 'La planilla ha sido eliminada correctamente.',
            });
          } else {
            Swal.fire({
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
              icon: 'error',
              title: 'Error',
              text: res.mensaje || 'No se pudo eliminar la planilla.',
            });
          }
        },
        error: (err) => {
          this.loadingService.hide();
          const isFkConstraint = err?.status === HttpStatusCode.Conflict;
          this.dialog.open(ConfirmDialogComponent, {
            width: '280px',
            data: {
              title: isFkConstraint ? 'No permitido' : 'Error de Conexión',
              type: 'alert',
              message: err?.error?.mensaje || 'No se pudo eliminar la planilla.'
            }
          });
        }
      });
    });
  }

  onClosePlanillaMovilidad(planilla: OrdenPagoCabPlanilla): void {
    if (!planilla.codPlanilla || planilla.statusPlanilla === 'CE') return;

    this.loadingService.show();

    this.planillaDetService.listarDetalle(
      planilla.codEmpresa!,
      planilla.codSucursal!,
      planilla.anioPeriodo!,
      planilla.codPeriodo!,
      planilla.numOrden!,
      planilla.codPlanilla
    ).subscribe({
      next: (response: any) => {
        this.loadingService.hide();

        const detalles = response.resultado || [];
        if (detalles.length === 0) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            showCloseButton: true,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            icon: 'warning',
            title: 'Planilla vacía',
            text: 'No se puede cerrar una planilla que no tiene detalles de movilidad.',
          });
          return;
        }
        this.openConfirmationDialog(planilla, detalles);
      },
      error: (err) => {
        this.loadingService.hide();
        console.error("Error fetching details", err);
      }
    });
  }

  private openConfirmationDialog(planilla: OrdenPagoCabPlanilla, detalles: any[]): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Cerrar Planilla',
        message: `¿Deseas cerrar la planilla ${planilla.codPlanilla}?`,
        type: 'confirm'
      }
    }).afterClosed().subscribe(result => {
      if (!result) return;

      this.processClosePlanilla(planilla, detalles);
    });
  }

  private processClosePlanilla(planilla: OrdenPagoCabPlanilla, detalles: any[]): void {
    this.loadingService.show();

    const payload: OrdenPagoCabPlanilla = {
      ...planilla,
      statusPlanilla: 'CE',
      fechaPlanillaClose: new Date()
    };

    this.planillaService.updatePlanillaMovilidad(payload).subscribe({
      next: (res: Response) => {
        if (res.error !== 0) {
          this.loadingService.hide();
          Swal.fire({ icon: 'error', title: 'Error', text: res.mensaje });
          return;
        }

        planilla.statusPlanilla = 'CE';
        planilla.fechaPlanillaClose = payload.fechaPlanillaClose;
        Swal.fire({
          toast: true,
          position: 'top-end',
          showCloseButton: true,
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
          icon: 'success',
          title: 'Planilla cerrada',
          text: 'La planilla se marcó como cerrada correctamente.',
        });

        const ordenPagoDetalles: OrdenPagoDetDTO[] =
          detalles.map(det => this.mapToOrdenPagoDet(planilla, det));

        this.ordenPagoDetService.saveOrdenPagoDetBatch(ordenPagoDetalles)
          .subscribe({
            next: (response: Response) => {
              if ((response.error ?? 0) === 1) {
                Swal.fire({ icon: 'error', title: 'Error', text: response.mensaje });
              }
              this.loadingService.hide();
            },
            error: () => {
              this.loadingService.hide();
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron guardar los detalles de la orden de pago.'
              });
            }
          });
      },
      error: (err) => {
        this.loadingService.hide();
        Swal.fire({
          icon: 'error',
          title: 'Error de Conexión',
          text: err?.error?.mensaje || 'No se pudo cerrar la planilla.'
        });
      }
    });
  }

  private mapToOrdenPagoDet(planilla: OrdenPagoCabPlanilla, detalle: any): OrdenPagoDetDTO {
    const ordenPagoDet = new OrdenPagoDetDTO();

    ordenPagoDet.codEmpresa = planilla.codEmpresa;
    ordenPagoDet.codSucursal = planilla.codSucursal;
    ordenPagoDet.numOrden = planilla.numOrden;
    ordenPagoDet.numSerieDoc = detalle.serDocumento;
    ordenPagoDet.numDocumento = detalle.numDocumento;
    ordenPagoDet.codAuxiliar = detalle.codAuxiliarProveedor;
    ordenPagoDet.impSoles = detalle.importe || 0;
    ordenPagoDet.fecDocumento = planilla.fechaPlanillaClose; 
    ordenPagoDet.codMoneda = '01';

    return ordenPagoDet;
  }
}
