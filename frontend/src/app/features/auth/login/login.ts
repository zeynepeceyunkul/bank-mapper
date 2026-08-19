import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayout } from '../auth-layout/auth-layout';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AuthLayout],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';

  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.email.trim() || !this.password) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authService.login({ email: this.email.trim(), password: this.password }).subscribe({
      // replaceUrl: true - "/login" gecmise yeni kayit olarak eklenmesin,
      // yerine gecsin. Aksi halde giris basarili olduktan sonra geri tusuna
      // basinca kullanici tekrar login formuna donuyordu.
      next: () => this.router.navigateByUrl('/', { replaceUrl: true }),
      error: (err) => {
        this.submitting.set(false);
        this.error.set(typeof err?.error === 'string' ? err.error : 'Giriş yapılamadı. API çalışıyor mu?');
      },
    });
  }
}
