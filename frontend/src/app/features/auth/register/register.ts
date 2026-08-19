import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from '../auth-layout/auth-layout';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, AuthLayout],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  passwordConfirm = '';

  readonly showPassword = signal(false);
  readonly showPasswordConfirm = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.email.trim() || !this.password || !this.passwordConfirm) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const email = this.email.trim();
    this.authService.register({ email, password: this.password, passwordConfirm: this.passwordConfirm }).subscribe({
      // replaceUrl: true - ayni sebep login.ts'teki gibi, geri tusuyla
      // doldurulmus kayit formuna donulmesin.
      next: () => this.router.navigate(['/check-email'], { queryParams: { email }, replaceUrl: true }),
      error: (err) => {
        this.submitting.set(false);
        this.error.set(typeof err?.error === 'string' ? err.error : 'Hesap oluşturulamadı. API çalışıyor mu?');
      },
    });
  }
}
