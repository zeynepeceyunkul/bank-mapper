import { Injectable, signal } from '@angular/core';

// role.guard.ts eskiden yetkisiz erisimde sayfayi hic acmadan Panel'e
// yonlendiriyordu (router.createUrlTree) - Ece'nin karari (2026-08-21):
// kullanici nereye gitmeye calistigini hic gormeden aninda isinlanmak da,
// Mapping'deki "goster ama uyar" gibi hicbir uyari gormeden gezinmek de
// kafa karistirici. Yeni akis: sayfaya izin ver (guard hep true donuyor),
// ama bu servis uzerinden bir bayrak kaldir - app-unauthorized-modal (app
// koku, ToastContainer/ConfirmDialog gibi) bunu gorunce uyariyi gosteriyor,
// kullanici kapatinca Panel'e yonlendiriyor.
@Injectable({ providedIn: 'root' })
export class PageAccessService {
  readonly denied = signal(false);

  flagDenied(): void {
    this.denied.set(true);
  }

  clearDenied(): void {
    this.denied.set(false);
  }
}
