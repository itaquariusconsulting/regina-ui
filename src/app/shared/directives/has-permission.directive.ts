import { Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { RegSecProfilePermissions } from '../../models/reg-sec-profile-permissions-dto';

@Directive({
  selector: '[appHasPermission]'
})
export class HasPermissionDirective implements OnInit {
  @Input() appHasPermission!: { route: string, action: keyof RegSecProfilePermissions };

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.authService.permissions$.subscribe(() => {
      this.applyPermission();
    });
  }

  private applyPermission() {
    this.viewContainer.clear();

    const hasAccess = this.authService.hasPermission(
      this.appHasPermission.route,
      this.appHasPermission.action
    );

    if (hasAccess) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
