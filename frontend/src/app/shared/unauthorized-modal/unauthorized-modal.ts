import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { PageAccessService } from '../../core/services/page-access.service';

@Component({
  selector: 'app-unauthorized-modal',
  imports: [MatButtonModule],
  templateUrl: './unauthorized-modal.html',
  styleUrl: './unauthorized-modal.scss',
})
export class UnauthorizedModal {
  private readonly router = inject(Router);
  readonly pageAccessService = inject(PageAccessService);

  dismiss(): void {
    this.pageAccessService.clearDenied();
    this.router.navigateByUrl('/');
  }
}
