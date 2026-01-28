import { Routes } from '@angular/router';
import { LoginComponent } from './views/login/login.component';
import { DefaultLayoutComponent } from './components/layout/default-layout/default-layout.component';
import { ListOrdenPagoComponent } from './views/list-orden-pago/list-orden-pago.component';
import { SettingsComponent } from './views/settings/settings.component';

export const routes: Routes = [
  {
    path: '',
    component: LoginComponent
  },
  {
    path: 'login',
    component: LoginComponent
  },

  // Rutas con layout (primarias)
  {
    path: '',
    component: DefaultLayoutComponent,
    children: [
      {
        path: 'list-orders',
        component: ListOrdenPagoComponent
      },
      {
        path: 'settings',
        component: SettingsComponent
      }
    ]
  }
];
