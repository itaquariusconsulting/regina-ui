import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogData } from '../../models/globals/confirm-dialog-data';

@Component({
    selector: 'app-confirm-dialog',
    imports: [MatDialogModule],
    template: `
    <h4 mat-dialog-title style="background-color: var(--primary-color); color: white !important;">{{ data.title }}</h4>
    <mat-dialog-content style="font-family: var(--app-font-family);font-size: 12px !important" class="d-flex flex-column gap-3">
        {{ data.message }}
    </mat-dialog-content>
    <mat-dialog-actions class="d-flex justify-content-end gap-2">
        @if (data.type === 'alert') {
            <button style="font-family: var(--app-font-family);font-size: 11px !important" mat-button
                class="general-button btn-danger"
                (click)="onClose()">
                Cerrar
            </button>
        }
        @if (data.type === 'confirm') {
            <button style="font-family: var(--app-font-family);font-size: 11px !important" mat-button
                class="general-button btn-danger"
                (click)="onClose()">
                Cerrar
            </button>
            <button style="font-family: var(--app-font-family);font-size: 11px !important" mat-button
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
