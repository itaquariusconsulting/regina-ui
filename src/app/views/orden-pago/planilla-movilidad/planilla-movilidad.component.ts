import { Component, OnInit } from '@angular/core';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs/internal/Observable';
import { LoadingService } from '../../../services/loading.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { OrdenPago } from '../../../models/orden-pago';
import { Response } from '../../../models/response';
import { DeviceService } from '../../../services/core-service/device.service';
import { OrdenPagoPlanillaMovilidadCabService } from '../../../services/orden-pago-planilla-movilidad-cab.service';
import { WrapperRequestPlanillaMovilidadCab } from '../../../models/wrappers/wrapper-request-planilla-movilidad-cab';
import { Router } from '@angular/router';
import { MaeDocumento } from '../../../models/mae-documento';
import { OrdenPagoCabPlanilla } from '../../../models/orden-pago-planilla-movilidad-cab';
@Component({
  selector: 'app-planilla-movilidad',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './planilla-movilidad.component.html',
  styleUrl: './planilla-movilidad.component.scss'
})
export class PlanillaMovilidadComponent implements OnInit {

  constructor(private location: Location,
    private loadingService: LoadingService,
    private planillaService: OrdenPagoPlanillaMovilidadCabService,
    private deviceService: DeviceService,
    private router: Router) {
    this.isLoading$ = this.loadingService.loading$;
  }

  codEmpresa: string = sessionStorage.getItem("codempresa") ?? '';
  isLoading$: Observable<boolean>;

  codAuxiliar: string = '';

  orden: OrdenPago = new OrdenPago();
  planillas: OrdenPagoCabPlanilla[] = [];
  pageSize = 6;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;

  isDesktop: boolean = false;

  documentosGeneral: MaeDocumento[] = [];

  ngOnInit(): void {
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data.orden;
    }
    console.log("Orden: ", this.orden);
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

  onEditPlanillaMovilidad() {
    this.router.navigate(['/edit-planilla-movilidad'], { state: { data: this.orden } });
  }
}
