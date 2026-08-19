import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// authGuard'in tersi - zaten giris yapmis biri /login veya /register'a
// (geri tusuyla ya da elle) tekrar giderse dogrudan uygulamaya donsun,
// bos bir login/kayit formuyla karsilasmasin.
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
