import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthLayout } from '../auth-layout/auth-layout';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-check-email',
  imports: [RouterLink, AuthLayout],
  templateUrl: './check-email.html',
  styleUrl: './check-email.scss',
})
export class CheckEmail {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  readonly email = this.route.snapshot.queryParamMap.get('email') ?? '';

  readonly resending = signal(false);
  readonly resent = signal(false);

  resend(): void {
    if (!this.email || this.resending()) {
      return;
    }

    this.resending.set(true);
    this.authService.resendVerification({ email: this.email }).subscribe({
      // Backend hesap var/yok ya da dogrulanmis mi bilgisini disariya
      // sizdirmiyor (bkz. AuthService.ResendVerificationAsync) - burada da
      // her zaman ayni "gonderildi" mesajini gosteriyoruz.
      next: () => {
        this.resending.set(false);
        this.resent.set(true);
      },
      error: () => {
        this.resending.set(false);
        this.resent.set(true);
      },
    });
  }
}
