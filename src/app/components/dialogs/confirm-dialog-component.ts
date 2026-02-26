import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogData } from '../../models/globals/confirm-dialog-data';

@Component({
    selector: 'app-confirm-dialog',
    imports: [MatDialogModule],
    template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
        {{ data.message }}
    </mat-dialog-content>
    <mat-dialog-actions class="d-flex justify-content-end gap-2">
        @if (data.type === 'alert') {
            <button mat-button
                class="general-button btn-danger"
                (click)="onClose()">
                Cerrar
            </button>
        }
        @if (data.type === 'confirm') {
            <button mat-button
                class="general-button btn-danger"
                (click)="onClose()">
                Cerrar
            </button>
            <button mat-button  
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
