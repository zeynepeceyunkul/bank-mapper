import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ToastContainer } from './shared/toast/toast-container';
import { ConfirmDialog } from './shared/confirm/confirm-dialog';
import { AuthService } from './core/services/auth.service';
import { MappingService } from './core/services/mapping.service';

// Giris/kayit/e-posta akisi sayfalari kendi tam-ekran duzenine sahip (bkz.
// features/auth/auth-layout) - uygulamanin normal toolbar+icerik cercevesini
// gostermemeli.
const STANDALONE_AUTH_PATHS = ['/login', '/register', '/check-email', '/verify-email'];

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    ToastContainer,
    ConfirmDialog,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly mappingService = inject(MappingService);
  private readonly router = inject(Router);

  private readonly currentUrl = signal(this.router.url);

  readonly isLoggedIn = computed(() => this.authService.token() !== null);
  readonly email = this.authService.email;
  readonly isAuthPage = computed(() => STANDALONE_AUTH_PATHS.some((p) => this.currentUrl().startsWith(p)));

  // Ece'nin karari (2026-08-19): Onizleme/Onaylar nav linkleri artik
  // yetkisi olmayana da gorunur - tiklayinca role.guard.ts onları Panel'e
  // geri gonderip bir uyari gosteriyor, once burada sessizce gizlemek
  // yerine. canApprove burada sadece rozet sayisini kimin gorecegini
  // belirlemek icin hala lazim (bkz. asagisi).
  readonly canApprove = computed(() => this.authService.hasRole('Admin', 'Approver'));

  // Sekmenin yanindaki sayi rozeti - dashboard.ts'teki pendingApprovalCount
  // ile ayni gerekce, burada her navigasyonda yenileniyor ki Onay
  // Bekleyenler ekraninda bir mapping onaylayip/reddedince rozet de guncel
  // kalsin (o ekran kendi sayfasindan ayrilinca NavigationEnd tetiklenir).
  readonly pendingApprovalCount = signal<number | null>(null);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.refreshPendingApprovalCount();
    });
    this.refreshPendingApprovalCount();
  }

  private refreshPendingApprovalCount(): void {
    if (!this.isLoggedIn() || !this.canApprove()) {
      return;
    }
    this.mappingService.getPage(0, 1, 'RecentFirst', '', 'PendingApproval').subscribe({
      next: (result) => this.pendingApprovalCount.set(result.totalCount),
      error: () => {}, // sessiz gec - rozet ikincil bir bilgi, navigasyonu engellememeli
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
