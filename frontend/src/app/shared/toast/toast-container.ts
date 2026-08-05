import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [MatIconModule],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss',
})
export class ToastContainer {
  readonly toastService = inject(ToastService);
}
