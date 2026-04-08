import { Routes } from '@angular/router';
import { LoginComponent } from './views/login/login.component';
import { DefaultLayoutComponent } from './components/layout/default-layout/default-layout.component';
import { ListOrdenPagoComponent } from './views/orden-pago/list-orden-pago/list-orden-pago.component';
import { ListOrdenPagoDetComponent } from './views/orden-pago/list-orden-pago-det/list-orden-pago-det.component';
import { ListUsuariosComponent } from './views/usuario/list-usuarios/list-usuarios.component';
import { NuevoUsuarioComponent } from './views/usuario/nuevo-usuario/nuevo-usuario.component';
import { EditUsuarioComponent } from './views/usuario/edit-usuario/edit-usuario.component';
import { ListPerfilesComponent } from './views/perfil/list-perfiles/list-perfiles.component';
import { NuevoPerfilComponent } from './views/perfil/nuevo-perfil/nuevo-perfil.component';
import { EditPerfilComponent } from './views/perfil/edit-perfil/edit-perfil.component';
import { HomeComponent } from './views/home/home.component';
import { ListValidacionesComponent } from './views/validates/list-validaciones/list-validaciones.component';
import { NuevoValidacionComponent } from './views/validates/nuevo-validacion/nuevo-validacion.component';
import { EditValidacionComponent } from './views/validates/edit-validacion/edit-validacion.component';
import { EditRendirCuentaComponent } from './views/orden-pago/edit-rendir-cuenta/edit-rendir-cuenta.component';
import { ListPermisosComponent } from './views/permisos/list-permisos/list-permisos.component';
import { ViewOrdenPagoComponent } from './views/orden-pago/view-orden-pago/view-orden-pago.component';
import { PlanillaMovilidadComponent } from './views/orden-pago/planilla-movilidad/planilla-movilidad.component';
import { EditPlanillaMovilidadComponent } from './views/orden-pago/edit-planilla-movilidad/edit-planilla-movilidad.component';

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
        path: 'view-order',
        component: ViewOrdenPagoComponent
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
        path: 'planilla-movilidad',
        component: PlanillaMovilidadComponent
      },
      {
        path: 'edit-planilla-movilidad',
        component: EditPlanillaMovilidadComponent
      },
      {
        path: 'list-usuarios',
        component: ListUsuariosComponent
      },
      {
        path: 'nuevo-usuario',
        component: NuevoUsuarioComponent
      },
      {
        path: 'edit-usuario/:id',
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
        path: 'nuevo-validacion',
        component: NuevoValidacionComponent
      },
      {
        path: 'edit-validacion/:id',
        component: EditValidacionComponent
      },
    ]
  }
];
