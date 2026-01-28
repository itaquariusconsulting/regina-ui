import { CommonModule } from '@angular/common';
import { Component, input, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { Router} from '@angular/router';
import { RegSecUser } from '../../../../models/reg-sec-user';

import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-default-header',
  standalone: true,
  templateUrl: './default-header.component.html',
  styleUrl: './default-header.component.scss',
  imports: [CommonModule, FormsModule],
  schemas: [NO_ERRORS_SCHEMA]
})
export class DefaultHeaderComponent  implements OnInit {
  nombresCompletos: string = '';
  empresa: string = '';
  user: RegSecUser = JSON.parse(sessionStorage.getItem('user') || '{}');

  count = 0;
  showDropdown: boolean = false;

  meses = [
    { nombre: 'Enero', value: 1 },
    { nombre: 'Febrero', value: 2 },
    { nombre: 'Marzo', value: 3 },
    { nombre: 'Abril', value: 4 },
    { nombre: 'Mayo', value: 5 },
    { nombre: 'Junio', value: 6 },
    { nombre: 'Julio', value: 7 },
    { nombre: 'Agosto', value: 8 },
    { nombre: 'Septiembre', value: 9 },
    { nombre: 'Octubre', value: 10 },
    { nombre: 'Noviembre', value: 11 },
    { nombre: 'Diciembre', value: 12 },
  ];

  periodo: string = '';

  private subscription: Subscription = new Subscription();

  readonly colorModes = [
    { name: 'light', text: 'Light', icon: 'cilSun' },
    { name: 'dark', text: 'Dark', icon: 'cilMoon' },
    { name: 'auto', text: 'Auto', icon: 'cilContrast' }
  ];

  constructor(private router: Router) {

  }
  ngOnInit(): void {
    this.nombresCompletos = sessionStorage.getItem('nombresCompletos') || '';
    this.empresa = sessionStorage.getItem('razonSocial') || '';
    this.periodo = (this.meses.find(m => m.value === parseInt(sessionStorage.getItem('periodo_month') || ''))?.nombre ?? '') + ' del ' + sessionStorage.getItem('periodo_year');
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  onToggleSidebar() {

  }


  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  sidebarId = input('sidebar1');

  onList() {
    this.router.navigate(['/messages']);
  }

  onChangePassword() {
    this.router.navigate(['/cambiar-password']);
  }

  public newMessages = [
    {
      id: 0,
      from: 'Jessica Williams',
      avatar: '7.jpg',
      status: 'success',
      title: 'Urgent: System Maintenance Tonight',
      time: 'Just now',
      link: 'apps/email/inbox/message',
      message: 'Attention team, we\'ll be conducting critical system maintenance tonight from 10 PM to 2 AM. Plan accordingly...'
    },
    {
      id: 1,
      from: 'Richard Johnson',
      avatar: '6.jpg',
      status: 'warning',
      title: 'Project Update: Milestone Achieved',
      time: '5 minutes ago',
      link: 'apps/email/inbox/message',
      message: 'Kudos on hitting sales targets last quarter! Let\'s keep the momentum. New goals, new victories ahead...'
    },
    {
      id: 2,
      from: 'Angela Rodriguez',
      avatar: '5.jpg',
      status: 'danger',
      title: 'Social Media Campaign Launch',
      time: '1:52 PM',
      link: 'apps/email/inbox/message',
      message: 'Exciting news! Our new social media campaign goes live tomorrow. Brace yourselves for engagement...'
    },
    {
      id: 3,
      from: 'Jane Lewis',
      avatar: '4.jpg',
      status: 'info',
      title: 'Inventory Checkpoint',
      time: '4:03 AM',
      link: 'apps/email/inbox/message',
      message: 'Team, it\'s time for our monthly inventory check. Accurate counts ensure smooth operations. Let\'s nail it...'
    },
    {
      id: 3,
      from: 'Ryan Miller',
      avatar: '4.jpg',
      status: 'info',
      title: 'Customer Feedback Results',
      time: '3 days ago',
      link: 'apps/email/inbox/message',
      message: 'Our latest customer feedback is in. Let\'s analyze and discuss improvements for an even better service...'
    }
  ];

  public newNotifications = [
    { id: 0, title: 'New user registered', icon: 'cilUserFollow', color: 'success' },
    { id: 1, title: 'User deleted', icon: 'cilUserUnfollow', color: 'danger' },
    { id: 2, title: 'Sales report is ready', icon: 'cilChartPie', color: 'info' },
    { id: 3, title: 'New client', icon: 'cilBasket', color: 'primary' },
    { id: 4, title: 'Server overloaded', icon: 'cilSpeedometer', color: 'warning' }
  ];

  public newStatus = [
    { id: 0, title: 'CPU Usage', value: 25, color: 'info', details: '348 Processes. 1/4 Cores.' },
    { id: 1, title: 'Memory Usage', value: 70, color: 'warning', details: '11444GB/16384MB' },
    { id: 2, title: 'SSD 1 Usage', value: 90, color: 'danger', details: '243GB/256GB' }
  ];

  public newTasks = [
    { id: 0, title: 'Upgrade NPM', value: 0, color: 'info' },
    { id: 1, title: 'ReactJS Version', value: 25, color: 'danger' },
    { id: 2, title: 'VueJS Version', value: 50, color: 'warning' },
    { id: 3, title: 'Add new layouts', value: 75, color: 'info' },
    { id: 4, title: 'Angular Version', value: 100, color: 'success' }
  ];

  onLogout() {
    sessionStorage.removeItem("isLoggedIn");
    //sessionStorage.setItem("windowForm", '0');
    this.router.navigate(['/login']);
  }

}
