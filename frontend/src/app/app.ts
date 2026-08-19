import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ToastContainer } from './shared/toast/toast-container';
import { ConfirmDialog } from './shared/confirm/confirm-dialog';
import { AuthService } from './core/services/auth.service';

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
  private readonly router = inject(Router);

  private readonly currentUrl = signal(this.router.url);

  readonly isLoggedIn = computed(() => this.authService.token() !== null);
  readonly email = this.authService.email;
  readonly isAuthPage = computed(() => STANDALONE_AUTH_PATHS.some((p) => this.currentUrl().startsWith(p)));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.currentUrl.set(this.router.url);
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
