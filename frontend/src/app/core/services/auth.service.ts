import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  LoginResult,
  RegisterRequest,
  ResendVerificationRequest,
  VerifyEmailRequest,
} from '../models/auth.model';

const TOKEN_KEY = 'bankmapper_token';
const EMAIL_KEY = 'bankmapper_email';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  // Sayfa yenilendiginde oturumun kaybolmamasi icin localStorage'dan okunuyor
  // - sunucu tarafinda gecerliligini dogrulamiyoruz, gecersiz/suresi dolmus
  // bir token varsa ilk korumali API cagrisi 401 donup interceptor oturumu
  // zaten sonlandiracak (bkz. auth.interceptor.ts).
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly email = signal<string | null>(localStorage.getItem(EMAIL_KEY));

  register(request: RegisterRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/register`, request);
  }

  login(request: LoginRequest): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${environment.apiUrl}/auth/login`, request).pipe(
      tap((result) => {
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(EMAIL_KEY, result.email);
        this.token.set(result.token);
        this.email.set(result.email);
      }),
    );
  }

  verifyEmail(request: VerifyEmailRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/verify-email`, request);
  }

  resendVerification(request: ResendVerificationRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/resend-verification`, request);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    this.token.set(null);
    this.email.set(null);
  }

  isAuthenticated(): boolean {
    return this.token() !== null;
  }
}
