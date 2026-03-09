import { Component } from '@angular/core';
import { DeviceService } from '../../services/core-service/device.service';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})


export class HomeComponent {
desktopDevice: boolean = false;
constructor(private deviceService: DeviceService) {
  this.desktopDevice = this.deviceService.isDesktopDevice();
}
}
