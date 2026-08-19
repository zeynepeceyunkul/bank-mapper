import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Sadece kendi API'mize giden isteklere token ekleniyor - baska bir
  // host'a (ör. ileride eklenebilecek bir servise) sizmasin diye.
  const token = authService.token();
  const authorizedReq = req.url.startsWith(environment.apiUrl) && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && authService.isAuthenticated()) {
        authService.logout();
        router.navigateByUrl('/login');
      }

      return throwError(() => error);
    }),
  );
};
