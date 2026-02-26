export interface ConfirmDialogData {
  title: string;
  message: string;
  type?: 'confirm' | 'alert' | 'warning' | 'info' | 'success' | 'error';
  confirmText?: string;
  cancelText?: string;
}