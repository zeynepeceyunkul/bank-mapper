import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthLayout } from '../auth-layout/auth-layout';
import { AuthService } from '../../../core/services/auth.service';

type VerifyState = 'checking' | 'success' | 'failure';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, AuthLayout],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  private email = '';
  readonly state = signal<VerifyState>('checking');
  readonly resending = signal(false);
  readonly resent = signal(false);

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.email || !token) {
      this.state.set('failure');
      return;
    }

    this.authService.verifyEmail({ email: this.email, token }).subscribe({
      next: () => this.state.set('success'),
      error: () => this.state.set('failure'),
    });
  }

  resend(): void {
    if (!this.email || this.resending()) {
      return;
    }

    this.resending.set(true);
    this.authService.resendVerification({ email: this.email }).subscribe({
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
