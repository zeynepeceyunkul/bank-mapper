import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

// authGuard'in ustune, route data'sindaki "roles" listesine gore ek bir
// yetki kontrolu ekliyor - kullanici giris yapmis ama yetkisiz rotaya
// gitmeye calisirsa Panel'e geri donduruyor. Ece'nin karari (2026-08-19):
// yetkisiz oldugu ekranlari/butonlari tamamen gizlemek yerine gorunur
// birakip denemesinde acik bir uyari vermek - bu yuzden nav linkleri artik
// her zaman render ediliyor, gercek engelleme (ve kullaniciya gorunen tek
// aciklama) burada, tek bir yerde yapiliyor.
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  const allowedRoles = route.data['roles'] as string[] | undefined;
  if (!allowedRoles || allowedRoles.length === 0 || authService.hasRole(...allowedRoles)) {
    return true;
  }

  toastService.error('Bu sayfa için yetkiniz yok.');
  return router.createUrlTree(['/']);
};
