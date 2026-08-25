import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ToastContainer } from './shared/toast/toast-container';
import { ConfirmDialog } from './shared/confirm/confirm-dialog';
import { UnauthorizedModal } from './shared/unauthorized-modal/unauthorized-modal';
import { AuthService } from './core/services/auth.service';
import { MappingService } from './core/services/mapping.service';
import { PageAccessService } from './core/services/page-access.service';

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
    UnauthorizedModal,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly mappingService = inject(MappingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageAccessService = inject(PageAccessService);

  private readonly currentUrl = signal(this.router.url);

  readonly isLoggedIn = computed(() => this.authService.token() !== null);
  readonly email = this.authService.email;
  readonly role = this.authService.role;
  readonly isAuthPage = computed(() => STANDALONE_AUTH_PATHS.some((p) => this.currentUrl().startsWith(p)));

  // Figma Make'ten secilen "B" kompozisyonu (avatar-only tetikleyici, koyu
  // baslikli dropdown) - eskiden sag ustte hep acik duran duz e-posta yazisi +
  // ayri bir cikis ikonuydu, simdi tek bir avatara tiklayinca acilan kucuk bir
  // panelde e-posta+rol+cikis birlikte gosteriliyor.
  readonly showProfileMenu = signal(false);

  toggleProfileMenu(): void {
    this.showProfileMenu.update((v) => !v);
  }

  get avatarInitial(): string {
    return (this.email() ?? '?').charAt(0).toUpperCase();
  }

  roleClass(): string {
    return (this.role() ?? '').toLowerCase();
  }

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
    // Ece'nin karari (2026-08-24): "Yetkin Yok" modal'ini kapatmadan (Tamam'a
    // basmadan) baska bir nav sekmesine tiklayinca modal asili kalip arka
    // planda sayfa degisebiliyordu - eskiden burada HER navigasyon basinda
    // bayragi onceden temizliyorduk (roleGuard'siz rotalara gecisi kolaylastirmak
    // icin), ama bu tam olarak modal acikken serbestce gezinmeye izin veren
    // sey oldugu ortaya cikti. Artik bayragi burada ONCEDEN TEMIZLEMIYORUZ -
    // bunun yerine block-nav-while-unauthorized-modal.guard.ts (root rotaya
    // canActivateChild olarak baglanan, bkz. app.routes.ts) modal acikken
    // (denied() true) TUM navigasyonlari iptal ediyor. Bayragi artik SADECE
    // roleGuard (yetkiliyse) veya modal'in kendi dismiss()'i temizliyor.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.refreshPendingApprovalCount();
    });
    // Onaylar ekraninin kendisinden (approval-queue.ts / mapping-editor.ts)
    // sayfadan hic ayrilmadan onayla/reddet yapinca da rozet hemen guncellensin
    // diye - eskiden sadece yukaridaki NavigationEnd tetikliyordu, bu yuzden
    // rozet ancak baska bir route'a gecilince duzeliyordu (Ece'nin bulgusu).
    this.mappingService.approvalChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
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
    this.showProfileMenu.set(false);
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
