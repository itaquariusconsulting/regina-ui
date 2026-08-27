import { Routes } from '@angular/router';
import { LoginComponent } from './views/login/login.component';
import { DefaultLayoutComponent } from './components/layout/default-layout/default-layout.component';
import { ListOrdenPagoComponent } from './views/orden-pago/list-orden-pago/list-orden-pago.component';
import { ListOrdenPagoDetComponent } from './views/orden-pago/list-orden-pago-det/list-orden-pago-det.component';
import { ListOpRendidasComponent } from './views/orden-pago/list-op-rendidas/list-op-rendidas.component';
import { ListUsuariosComponent } from './views/usuario/list-usuarios/list-usuarios.component';
import { NuevoUsuarioComponent } from './views/usuario/nuevo-usuario/nuevo-usuario.component';
import { CargaMasivaUsuariosComponent } from './views/usuario/carga-masiva-usuarios/carga-masiva-usuarios.component';
import { EditUsuarioComponent } from './views/usuario/edit-usuario/edit-usuario.component';
import { ListPerfilesComponent } from './views/perfil/list-perfiles/list-perfiles.component';
import { NuevoPerfilComponent } from './views/perfil/nuevo-perfil/nuevo-perfil.component';
import { EditPerfilComponent } from './views/perfil/edit-perfil/edit-perfil.component';
import { ListValidacionesComponent } from './views/validates/list-validaciones/list-validaciones.component';
import { NuevoValidacionComponent } from './views/validates/nuevo-validacion/nuevo-validacion.component';
import { EditValidacionComponent } from './views/validates/edit-validacion/edit-validacion.component';
import { EditRendirCuentaComponent } from './views/orden-pago/edit-rendir-cuenta/edit-rendir-cuenta.component';
import { ListPermisosComponent } from './views/permisos/list-permisos/list-permisos.component';
import { ViewOrdenPagoComponent } from './views/orden-pago/view-orden-pago/view-orden-pago.component';
import { PlanillaMovilidadComponent } from './views/orden-pago/planilla-movilidad/planilla-movilidad.component';
import { EditPlanillaMovilidadComponent } from './views/orden-pago/edit-planilla-movilidad/edit-planilla-movilidad.component';
import { ChangePasswordComponent } from './views/usuario/change-password/change-password.component';
import { authGuard } from './guards/auth.guard';
import { DashboardComponent } from './views/dashboard/dashboard.component';
import { ReportesComponent } from './views/reportes/reportes.component';
import { ReportesRendicionComponent } from './views/reportes/reportes-rendicion/reportes-rendicion.component';
import { CoreNotStartedComponent } from './views/no-core/core-not-started.component';

export const routes: Routes = [

  {
    // Bloqueo cuando no hay sesión del CORE de Seguridad (sin login propio).
    path: 'no-core',
    component: CoreNotStartedComponent
  },

  {
    path: 'login',
    component: LoginComponent
  },

  // Rutas con layout (primarias)
  {
    path: '',
    component: DefaultLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        component: DashboardComponent
      },
      {
        path: 'dashboard',
        component: DashboardComponent
      },
      {
        path: 'reportes',
        component: ReportesComponent
      },
      {
        path: 'home',
        redirectTo: 'dashboard',
        pathMatch: 'full'
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
        // Pantalla de contabilidad: las OP que el usuario ya rindio, para
        // continuar con la liquidacion. El acceso se controla por el menu y
        // los permisos, no por la ruta.
        path: 'list-op-rendidas',
        component: ListOpRendidasComponent
      },
      {
        // Los tres reportes de rendicion, en pestanas. Solo lectura: no
        // escribe nada, ni en REGINA ni en contabilidad.
        path: 'reportes-rendicion',
        component: ReportesRendicionComponent
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
        path: 'carga-masiva-usuarios',
        component: CargaMasivaUsuariosComponent
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
      {
        path: 'change-password',
        component: ChangePasswordComponent
      }
    ]
  }
];
