import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResult,
  RegisterRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '../models/auth.model';

const TOKEN_KEY = 'bankmapper_token';
const EMAIL_KEY = 'bankmapper_email';
const ROLE_KEY = 'bankmapper_role';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // Sayfa yenilendiginde oturumun kaybolmamasi icin localStorage'dan okunuyor
  // - sunucu tarafinda gecerliligini dogrulamiyoruz, gecersiz/suresi dolmus
  // bir token varsa ilk korumali API cagrisi 401 donup interceptor oturumu
  // zaten sonlandiracak (bkz. auth.interceptor.ts).
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly email = signal<string | null>(localStorage.getItem(EMAIL_KEY));
  readonly role = signal<string | null>(localStorage.getItem(ROLE_KEY));

  register(request: RegisterRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/register`, request);
  }

  login(request: LoginRequest): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${environment.apiUrl}/auth/login`, request).pipe(
      tap((result) => {
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(EMAIL_KEY, result.email);
        localStorage.setItem(ROLE_KEY, result.role);
        this.token.set(result.token);
        this.email.set(result.email);
        this.role.set(result.role);
      }),
    );
  }

  verifyEmail(request: VerifyEmailRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/verify-email`, request);
  }

  resendVerification(request: ResendVerificationRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/resend-verification`, request);
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/reset-password`, request);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(ROLE_KEY);
    this.token.set(null);
    this.email.set(null);
    this.role.set(null);
  }

  isAuthenticated(): boolean {
    return this.token() !== null;
  }

  hasRole(...roles: string[]): boolean {
    const currentRole = this.role();
    return currentRole !== null && roles.includes(currentRole);
  }
}
