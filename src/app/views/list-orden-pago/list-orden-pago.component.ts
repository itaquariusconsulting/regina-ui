import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnInit, ViewChild } from '@angular/core';
import { User } from '../../models/user';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdenPago } from '../../models/orden-pago';

@Component({
  selector: 'app-list-orden-pago',
  templateUrl: './list-orden-pago.component.html',
  styleUrls: ['./list-orden-pago.component.scss'],
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ListOrdenPagoComponent implements OnInit {


  @ViewChild('myTable', { static: true }) tableRef!: ElementRef;

  // Datos de ejemplo
  data: OrdenPago[] = [];

  // Columnas de la tabla
  columns = [
    { key: 'numero', label: 'Nro.Orden', color: 'PRIMARY' },
    { key: 'fecha', label: 'Fecha Orden', color: 'SUCCESS' },
    { key: 'concepto', label: 'Concepto', color: 'DANGER' },
    { key: 'moneda', label: 'Moneda', color: 'DANGER' },
    { key: 'importe', label: 'Importe', color: 'DANGER' },
    { key: 'estado', label: 'Estado', color: 'DANGER' },
  ];

  ngOnInit(): void {
    const ORDEN_PAGO_MOCK: OrdenPago = {
      numOrden: '000016172',
      fecOrden: new Date('2026-01-21T00:00:00'),
      cDesTipoGasto: 'ENTREGAS A RENDIR CUENTA',
      cDesMoneda: 'S/',
      impOrdPago: 1000.00,
      cDesTado: 'PENDIENTE',
    };

    this.data.push(ORDEN_PAGO_MOCK);
  }

}
