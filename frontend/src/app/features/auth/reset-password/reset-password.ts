import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthLayout } from '../auth-layout/auth-layout';
import { AuthService } from '../../../core/services/auth.service';

// verify-email.ts'teki ayni state-machine deseni, ama 'checking' durumu yok:
// dogrulama linkinin aksine bir sifre sifirlama token'i sadece BASVURULARAK
// (yeni sifreyle birlikte) tuketilebilir, "sadece gecerli mi" diye ayri bir
// on-kontrol endpoint'i yok - token'in gecersiz/suresi dolmus oldugu ancak
// form gonderilince ortaya cikar.
type ResetState = 'form' | 'missingLink' | 'success';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink, AuthLayout],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  private email = '';
  private token = '';

  readonly state = signal<ResetState>('form');
  readonly showPassword = signal(false);
  readonly showPasswordConfirm = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  password = '';
  passwordConfirm = '';

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.email || !this.token) {
      this.state.set('missingLink');
    }
  }

  onSubmit(): void {
    if (!this.password || !this.passwordConfirm) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authService
      .resetPassword({ email: this.email, token: this.token, password: this.password, passwordConfirm: this.passwordConfirm })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.state.set('success');
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(typeof err?.error === 'string' ? err.error : 'Şifre sıfırlanamadı. API çalışıyor mu?');
        },
      });
  }
}
