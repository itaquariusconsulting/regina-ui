import { Routes } from '@angular/router';
import { LoginComponent } from './views/login/login.component';
import { DefaultLayoutComponent } from './components/layout/default-layout/default-layout.component';
import { ListOrdenPagoComponent } from './views/orden-pago/list-orden-pago/list-orden-pago.component';
import { SettingsComponent } from './views/settings/settings.component';
import { ListOrdenPagoDetComponent } from './views/orden-pago/list-orden-paso-det/list-orden-paso-det.component';
import { ListSolicitudComponent } from './views/solicitud/list-solicitud/list-solicitud.component';
import { EditSolicitudComponent } from './views/solicitud/edit-solicitud/edit-solicitud.component';
import { ListUsuariosComponent } from './views/usuario/list-usuarios/list-usuarios.component';
import { EditUsuarioComponent } from './views/usuario/edit-usuario/edit-usuario.component';
import { ListPerfilesComponent } from './views/perfil/list-perfiles/list-perfiles.component';
import { NuevoPerfilComponent } from './views/perfil/nuevo-perfil/nuevo-perfil.component';
import { EditPerfilComponent } from './views/perfil/edit-perfil/edit-perfil/edit-perfil.component';
import { HomeComponent } from './views/home/home.component';
import { ListValidacionesComponent } from './views/validates/list-validaciones/list-validaciones.component';
import { EditRegRenValidateComponent } from './views/validates/edit-validacion/edit-validacion.component';
import { EditRendirCuentaComponent } from './views/orden-pago/edit-rendir-cuenta/edit-rendir-cuenta.component';
import { ListPermisosComponent } from './views/permisos/list-permisos/list-permisos.component';

export const routes: Routes = [

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
        path: '',
        component: HomeComponent
      },
      {
        path: 'home',
        component: HomeComponent
      },
      {
        path: 'list-orders',
        component: ListOrdenPagoComponent
      },
      {
        path: 'edit-rendir-cuenta',
        component: EditRendirCuentaComponent
      },
      {
        path: 'list-orders-detail',
        component: ListOrdenPagoDetComponent
      },
      {
        path: 'list-solicitudes',
        component: ListSolicitudComponent
      },
      {
        path: 'edit-solicitud',
        component: EditSolicitudComponent
      },
      {
        path: 'list-usuarios',
        component: ListUsuariosComponent
      },
      {
        path: 'edit-usuario',
        component: EditUsuarioComponent
      },
      {
        path: 'list-perfiles',
        component: ListPerfilesComponent
      },
      {
        path: 'nuevo-perfil',
        component: NuevoPerfilComponent
      },
      {
        path: 'edit-perfil/:id',
        component: EditPerfilComponent
      },
      {
        path: 'list-permisos',
        component: ListPermisosComponent
      },
      {
        path: 'list-validaciones',
        component: ListValidacionesComponent
      },
      {
        path: 'edit-validacion',
        component: EditRegRenValidateComponent
      },
      {
        path: 'settings',
        component: SettingsComponent
      }
    ]
  }
];
