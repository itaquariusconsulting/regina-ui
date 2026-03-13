import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

import Tesseract from 'tesseract.js';

import { OrdenPago } from '../../../models/orden-pago';
import { OcrService } from '../../../services/ocr.service';
import { NgxCurrencyDirective } from 'ngx-currency';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { LoadingService } from '../../../services/loading.service';
import { Observable } from 'rxjs';
import { SunatService } from '../../../services/sunat-service';
import { Response } from '../../../models/response';
import { Router } from '@angular/router';
import { PadronRuc } from '../../../models/padron-ruc';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { RegRenValidate } from '../../../models/reg-ren-validate';
import { OrdenPagoDet } from '../../../models/orden-pago-det';
import { OrdenPagoDetService } from '../../../services/orden-pago-det.service';
import { WrapperRequestOrdenPagoDet } from '../../../models/wrappers/wrapper-request-orden-pago-det';
import { MaeAuxiliarDTO } from '../../../models/mae-auxiliar-dto';
import { MaestrosService } from '../../../services/maestros.service';
import { MaeDocumento } from '../../../models/mae-documento';
import * as bootstrap from 'bootstrap';
import { DocumentoService } from '../../../services/documento.service';
import { ConVoucherService } from '../../../services/con-voucher-item.service';
import { ConVoucherItem } from '../../../models/con-voucher.item';
import { WrapperRequestVoucherItem } from '../../../models/wrappers/wrapper-request-voucher-item';
@Component({
  selector: 'app-edit-orden-pago',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LoadingDancingSquaresComponent
  ],
  templateUrl: './list-orden-paso-det.component.html',
  styleUrls: ['./list-orden-paso-det.component.scss']
})
export class ListOrdenPagoDetComponent implements OnInit {

  constructor(
    private location: Location,
    private ordenPagoDetService: OrdenPagoDetService,
    private loadingService: LoadingService,
    private maestrosService: MaestrosService,
    private documentoService: DocumentoService,
    private conVoucherItemService: ConVoucherService
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  detail: OrdenPagoDet = new OrdenPagoDet();
  modal: any;

  codEmpresa: string = sessionStorage.getItem("codempresa") ?? '';
  isLoading$: Observable<boolean>;
  filtrarDetalle: string = "";
  orden: OrdenPago = new OrdenPago();
  pageSize = 8;
  currentPage = 0;
  totalItems = 0;
  totalPages = 0;
  detalles: OrdenPagoDet[] = [];
  ordenesGeneral: OrdenPagoDet[] = [];
  pagedDetalles: OrdenPagoDet[] = [];
  listaAuxiliares: MaeAuxiliarDTO[] = [];
  listaTiposDocumento: MaeDocumento[] = [];
  expandedRow: any = null;
  imagenDocumento: string | null = null;
  
  ngOnInit(): void {
    const state = history.state;
    if (state && state.data) {
      this.orden = state.data;
    }
    this.getListaAuxiliaresPR();
  }

  onBack(): void {
    this.location.back();
  }

  toggleRow(row: any) {
    if (this.expandedRow === row) {
      this.expandedRow = null;
    } else {
      this.expandedRow = row;
    }
  }

  filtrar() {

  }

  private buildPagination(): void {
    this.totalItems = this.detalles.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    this.pagedDetalles = this.detalles.slice(start, end);
  }

  changePage(page: number): void {

    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.buildPagination();
  }

  getOrdenPagoDet() {
    var wrapper: WrapperRequestOrdenPagoDet = new WrapperRequestOrdenPagoDet();
    wrapper.codEmpresa = this.orden.codEmpresa;
    wrapper.codSucursal = this.orden.codSucursal;
    wrapper.numOrden = this.orden.numOrden;
    this.ordenPagoDetService.getOrdenesPagoDet(wrapper).subscribe(
      (response: Response) => {
        this.loadingService.hide();
        this.detalles = response.resultado;
        this.currentPage = 0;
        this.buildPagination();
      },
      (error) => {
        this.loadingService.hide();
      }
    )
  }

  getListaAuxiliaresPR() {
    this.loadingService.show();
    this.maestrosService.getListaAuxiliaresPR(this.codEmpresa).subscribe(
      (response: Response) => {
        this.listaAuxiliares = response.resultado;
        this.listaAuxiliares.sort((a, b) => (a.codAuxiliar ?? '').localeCompare(b.codAuxiliar ?? ''));
        this.getListaDocumentos();
      },
      (error) => {
        console.log("No hay Auxiliares");
        this.loadingService.hide();
      }
    )
  }

  getListaDocumentos() {
    this.maestrosService.getTiposDocumento(this.codEmpresa).subscribe(
      (response: Response) => {
        this.listaTiposDocumento = response.resultado;
        this.getOrdenPagoDet();
      }
    )
  }

  getTipoDocumento(tipoDocumento: string): MaeDocumento {
    const doc = this.listaTiposDocumento.find(doc => doc.desCorta == tipoDocumento) ?? new MaeDocumento();
    return doc;
  }

  onDevuelveAuxiliar(codAuxiliar: string): MaeAuxiliarDTO {
    const aux: MaeAuxiliarDTO = this.listaAuxiliares.find(cod => cod.codAuxiliar?.trim() == codAuxiliar.trim()) ?? new MaeAuxiliarDTO();
    return aux;
  }

  abrirModalDoc(reg: OrdenPagoDet) {
    this.imagenDocumento = "";
    this.detail = reg;
    const name =
      (this.detail.codEmpresa ?? '0000') +
      this.detail.codSucursal +
      this.orden.numOrden +
      this.detail.numItemOp;
    this.viewDocumento(name);
  }

  cerrarModalDoc() {
    this.imagenDocumento = "";
    if (this.modal) {
      this.modal.hide();
    }
  }

  viewDocumento(nombre: string) {

    this.documentoService
      .viewDocumento(
        this.detail.codDocumento ?? '',
        this.orden.anoPeriodo ?? '',
        this.orden.codPeriodo ?? '',
        nombre
      )
      .subscribe({

        next: (blob) => {

          const reader = new FileReader();

          reader.onload = () => {

            this.imagenDocumento = reader.result as string;

            // abrir modal solo si existe documento
            const modalElement = document.getElementById('modalDocumento');

            if (modalElement) {
              this.modal = new bootstrap.Modal(modalElement);
              this.modal.show();
            }

          };

          reader.readAsDataURL(blob);

        },

        error: (err) => {

          console.log("Documento no encontrado");

          // aquí puedes mostrar un toast si quieres
          // this.toastService.warning("El documento no existe");

        }
      });
  }
}
