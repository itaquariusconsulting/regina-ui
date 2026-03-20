import { CommonModule, Location } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { RegRenValidate } from '../../../models/reg-ren-validate';
import { LoadingService } from '../../../services/loading.service';
import { RegRenValidateService } from '../../../services/reg-ren-validate.service';
import { ConfirmDialogComponent } from '../../../components/dialogs/confirm-dialog.component';
import { LoadingDancingSquaresComponent } from '../../../components/loading-dancing-squares/loading-dancing-squares.component';

@Component({
  selector: 'app-edit-validacion',
  imports: [CommonModule, FormsModule, LoadingDancingSquaresComponent],
  templateUrl: './edit-validacion.component.html',
  styleUrl: './edit-validacion.component.scss'
})
export class EditValidacionComponent implements OnInit {
  ruleId!: number;
  validationRule: RegRenValidate = new RegRenValidate();
  isLoading$: Observable<boolean>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private location: Location,
    private loadingService: LoadingService,
    private validationService: RegRenValidateService,

  ) {
    this.isLoading$ = this.loadingService.loading$;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.ruleId = +id;
      this.loadRuleData();
    }
  }

  loadRuleData(): void {
    this.loadingService.show();

    this.validationService.getRuleById(this.ruleId).subscribe({
      next: (res) => {
        if (res.error === 0 && res.resultado) {
          this.validationRule = res.resultado;
          this.loadingService.hide();
        }
      },
      error: () => this.loadingService.hide()
    });
  }

  onUpdateRule(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '280px',
      data: {
        title: 'Confirmar Actualización',
        message: '¿Estás seguro de que deseas guardar los cambios?',
        type: 'confirm'
      }
    }).afterClosed().subscribe(result => {
      if (!result) return;

      this.loadingService.show();

      const rule: RegRenValidate = { ...this.validationRule };

      this.validationService.patchRule(rule).subscribe({
        next: () => {
          this.loadingService.hide();
          this.router.navigate(['/list-validaciones']);
        },
        error: () => this.loadingService.hide()
      });
    });
  }

  onBack(): void {
    this.location.back();
  }
}
