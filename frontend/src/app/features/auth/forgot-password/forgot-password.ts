import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthLayout } from '../auth-layout/auth-layout';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, AuthLayout],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  private readonly authService = inject(AuthService);

  email = '';

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  // ForgotPasswordAsync hesabin var olup olmadigini disariya sizdirmadigi
  // icin (backend'deki enumeration-onlemi) burada da her zaman ayni "gonderildi"
  // durumuna geciyoruz - bilinmeyen bir e-posta icin bile gercek bir e-posta
  // gitmedigini kullaniciya soylemiyoruz.
  readonly sent = signal(false);
  readonly resending = signal(false);
  readonly resent = signal(false);

  onSubmit(): void {
    if (!this.email.trim()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authService.forgotPassword({ email: this.email.trim() }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(typeof err?.error === 'string' ? err.error : 'İstek gönderilemedi. API çalışıyor mu?');
      },
    });
  }

  // check-email.ts'teki resend() ile ayni desen.
  resend(): void {
    if (this.resending()) {
      return;
    }

    this.resending.set(true);
    this.authService.forgotPassword({ email: this.email.trim() }).subscribe({
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
