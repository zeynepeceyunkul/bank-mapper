import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmService } from '../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly confirmService = inject(ConfirmService);
}
