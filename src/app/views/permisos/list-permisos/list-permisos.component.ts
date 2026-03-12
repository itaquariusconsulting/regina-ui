import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { Response } from '../../../models/response';
import { RegSecProfile } from '../../../models/reg-sec-profile';
import { RegSecProfileService } from '../../../services/reg-sec-profile.service';
import { RegSecProfilePermissions } from '../../../models/reg-sec-profile-permissions-dto';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';

@Component({
  selector: 'app-list-permisos',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './list-permisos.component.html',
  styleUrl: './list-permisos.component.scss'
})
export class ListPermisosComponent implements OnInit {
  profiles: RegSecProfile[] = [];
  selectedProfileId: number | null = null;
  permissionMatrix: any[] = [];
  codEmpresa: string = '0001';
  isLoading$: Observable<boolean>;

  private readonly VIEW_FIELD: keyof RegSecProfilePermissions = 'permitView';
  private readonly permissionFields: (keyof RegSecProfilePermissions)[] =
    [this.VIEW_FIELD, 'permitCreate', 'permitEdit', 'permitDelete'];
  private readonly actionFields = this.permissionFields.filter(f => f !== this.VIEW_FIELD);

  constructor(
    private profileService: RegSecProfileService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private dialog: MatDialog,
  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    this.loadProfiles();
  }

  loadProfiles(): void {
    this.loadingService.show();
    this.profileService.getRegSecProfiles()
      .pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (res: Response) => this.profiles = res.resultado,
        error: (err) => console.error('Error loading profiles:', err)
      });
  }

  onProfileChange(profileId: any): void {
    this.selectedProfileId = profileId;
    if (this.selectedProfileId) {
      this.loadPermissionMatrix();
    } else {
      this.permissionMatrix = [];
      this.loadingService.hide();
    }
  }

  loadPermissionMatrix(): void {
    this.loadingService.show();
    this.authService.obtainProfilePermissions(this.selectedProfileId!, this.codEmpresa)
      .pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (data) => {
          this.permissionMatrix = this.organizeHierarchy(data);
        },
        error: (err) => console.error('Error loading matrix', err)
      });
  }

  savePermissions(): void {
    this.loadingService.show();
    this.authService.saveProfilePermissions(this.permissionMatrix)
      .pipe(finalize(() => this.loadingService.hide()))
      .subscribe({
        next: (res: Response) => {
          if (res.error === 0) {
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: '¡Éxito!',
                type: 'success',
                message: 'La configuración de permisos se ha guardado y sincronizado correctamente.'
              }
            });
          } else {
            this.dialog.open(ConfirmDialogComponent, {
              width: '280px',
              data: {
                title: 'Error de Validación',
                type: 'alert',
                message: res.mensaje || 'No se pudo completar la operación.'
              }
            });
          }
        },
        error: (err) => {
          this.dialog.open(ConfirmDialogComponent, {
            data: {
              title: 'Error de Conexión',
              type: 'alert',
              message: err.message || 'No se pudo establecer comunicación con el servidor. Por favor, intente más tarde.',
            }
          });
        }
      });
  }

  onPermissionChange(item: RegSecProfilePermissions, field: keyof RegSecProfilePermissions): void {
    const checked = !!item[field];

    if (item.menuParentId === null) {
      this.permissionMatrix
        .filter(child => child.menuParentId === item.menuId)
        .forEach(child => {
          (child[field] as boolean) = checked;
          this.applyLogicalDependencies(child, field);
        });
    }

    if (item.menuParentId !== null) {
      checked
        ? this.ensureParentActive(item.menuParentId, field)
        : this.cleanUpParentIfOrphaned(item.menuParentId, field);
    }

    this.applyLogicalDependencies(item, field);
  }

  private applyLogicalDependencies(item: RegSecProfilePermissions, fieldClicked: keyof RegSecProfilePermissions): void {
    if (fieldClicked === this.VIEW_FIELD && !item[this.VIEW_FIELD]) {
      this.actionFields.forEach(f => (item[f] as boolean) = false);
    }

    const hasActiveAction = this.actionFields.some(f => !!item[f]);
    if (hasActiveAction) {
      (item[this.VIEW_FIELD] as boolean) = true;
    }
  }

  private ensureParentActive(parentId: number, field: keyof RegSecProfilePermissions): void {
    const parent = this.permissionMatrix.find(p => p.menuId === parentId);
    if (!parent) return;

    (parent[field] as boolean) = true;
    this.applyLogicalDependencies(parent, field);

    if (parent.menuParentId !== null) {
      this.ensureParentActive(parent.menuParentId, field);
    }
  }

  private cleanUpParentIfOrphaned(parentId: number, field: keyof RegSecProfilePermissions): void {
    const parent = this.permissionMatrix.find(p => p.menuId === parentId);
    const hasActiveSibling = this.permissionMatrix.some(m => m.menuParentId === parentId && !!m[field]);

    if (!parent || hasActiveSibling) return;

    (parent[field] as boolean) = false;
    this.applyLogicalDependencies(parent, field);

    if (parent.menuParentId !== null) {
      this.cleanUpParentIfOrphaned(parent.menuParentId, field);
    }
  }

  private organizeHierarchy(flatList: RegSecProfilePermissions[]): RegSecProfilePermissions[] {
    const result: RegSecProfilePermissions[] = [];

    const parents = flatList.filter(item => item.menuParentId === null);
    parents.forEach(parent => {
      result.push(parent);

      const children = flatList.filter(item => item.menuParentId === parent.menuId);
      result.push(...children);
    });

    return result;
  }
}
