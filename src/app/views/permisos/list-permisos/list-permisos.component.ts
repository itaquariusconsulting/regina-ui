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
    private loadingService: LoadingService
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

  onProfileChange(profileId: any) {
    this.selectedProfileId = profileId;
    if (this.selectedProfileId) {
      this.loadPermissionMatrix();
    } else {
      this.permissionMatrix = [];
      this.loadingService.hide();
    }
  }

  loadPermissionMatrix() {
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

  savePermissions(): void { }

  onPermissionChange(item: RegSecProfilePermissions, field: keyof RegSecProfilePermissions): void {
    const newValue = item[field];

    if (item.menuParentId === null) {
      this.permissionMatrix
        .filter(child => child.menuParentId === item.menuId)
        .forEach(child => {
          (child[field] as boolean) = newValue as boolean;
          this.applyLogicalDependencies(child, field);
        });
    }

    this.applyLogicalDependencies(item, field);
  }

  private applyLogicalDependencies(item: RegSecProfilePermissions, fieldClicked: keyof RegSecProfilePermissions): void {
    if (fieldClicked === this.VIEW_FIELD && !item[this.VIEW_FIELD]) {
      this.actionFields.forEach(f => (item[f] as boolean) = false);
    }

    const hasActiveAction = this.actionFields.some(f => item[f] === true);
    if (hasActiveAction) {
      (item[this.VIEW_FIELD] as boolean) = true;
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
