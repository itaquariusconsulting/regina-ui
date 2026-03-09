import { CommonModule, Location } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-list-solicitud',
  imports: [CommonModule, FormsModule],
  templateUrl: './list-solicitud.component.html',
  styleUrl: './list-solicitud.component.scss'
})
export class ListSolicitudComponent {
  constructor(private location: Location) { }

  onBack() {
    this.location.back();
  }
}
