import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// authGuard'in ustune, route data'sindaki "roles" listesine gore ek bir
// yetki kontrolu ekliyor - kullanici giris yapmis ama yetkisiz rotaya
// gitmeye calisirsa Panel'e geri donduruyor.
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data['roles'] as string[] | undefined;
  if (!allowedRoles || allowedRoles.length === 0 || authService.hasRole(...allowedRoles)) {
    return true;
  }

  return router.createUrlTree(['/']);
};
