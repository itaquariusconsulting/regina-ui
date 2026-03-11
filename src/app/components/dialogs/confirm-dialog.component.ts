import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogData } from '../../models/globals/confirm-dialog-data';

@Component({
    selector: 'app-confirm-dialog',
    imports: [MatDialogModule],
    styleUrls: ['./confirm-dialog.component.scss'],
    template: `
    <div class="dialog-header">
        @if (data.type === 'success') {
            <i class="fa-solid fa-circle-check"></i>
        } @else {
            <i class="fa-solid fa-triangle-exclamation"></i>
        }
        <h4 class="h4" mat-dialog-title>{{ data.title }}</h4>
    </div>

    <mat-dialog-content class="dialog-content">
        {{ data.message }}
    </mat-dialog-content>

    <mat-dialog-actions class="d-flex justify-content-end gap-2">
        @if (data.type === 'alert' || data.type === 'success') {
            <button style="font-family: var(--app-font-family);font-size: 13px !important" mat-button
                class="general-button btn-primary"
                (click)="onClose()">
                Aceptar
            </button>
        }
        @if (data.type === 'confirm') {
            <button style="font-family: var(--app-font-family);font-size: 13px !important" mat-button
                class="general-button btn-danger"
                (click)="onClose()">
                Cerrar
            </button>
            <button style="font-family: var(--app-font-family);font-size: 13px !important" mat-button
                class="general-button btn-primary"
                (click)="onConfirm()">
                Confirmar
        </button>
        }
    </mat-dialog-actions>
`
})
export class ConfirmDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<ConfirmDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
    ) { }

    onClose(): void {
        this.dialogRef.close(false);
    }

    onConfirm(): void {
        this.dialogRef.close(true);
    }
}
