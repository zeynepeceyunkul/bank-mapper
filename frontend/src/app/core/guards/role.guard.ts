import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PageAccessService } from '../services/page-access.service';

// authGuard'in ustune, route data'sindaki "roles" listesine gore ek bir
// yetki kontrolu ekliyor. Ece'nin karari (2026-08-19): yetkisiz oldugu
// ekranlari/butonlari tamamen gizlemek yerine gorunur birakip denemesinde
// acik bir uyari vermek - nav linkleri her zaman render ediliyor.
//
// Ece'nin 2026-08-21'deki takip karari: eskiden burasi yetkisiz erisimde
// sayfayi hic acmadan router.createUrlTree(['/']) ile Panel'e yonlendiriyordu
// - ama bu da, hedeflenen sayfayi hic gormeden aninda isinlanmak da kafa
// karistirici bulundu. Artik guard HER ZAMAN true donuyor (navigasyonu asla
// engellemiyor), yetkisizlik durumunda sadece PageAccessService uzerinden bir
// bayrak kaldiriyor - app-unauthorized-modal (app kok bilesenine mount edilmis,
// bkz. app.html) bunu gorunce uyariyi gosterip kullanici kapatinca Panel'e
// yonlendiriyor. Boylece "goster + uyar" ilkesi artik SADECE Mapping'deki
// kismi-yetki eylemlerinde degil, tam sayfa erisiminde de tutarli uygulanmis
// oluyor.
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const pageAccessService = inject(PageAccessService);

  const allowedRoles = route.data['roles'] as string[] | undefined;
  if (!allowedRoles || allowedRoles.length === 0 || authService.hasRole(...allowedRoles)) {
    pageAccessService.clearDenied();
    return true;
  }

  pageAccessService.flagDenied();
  return true;
};
