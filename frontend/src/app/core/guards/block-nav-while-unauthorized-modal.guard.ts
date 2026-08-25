import { inject } from '@angular/core';
import { CanActivateChildFn } from '@angular/router';
import { PageAccessService } from '../services/page-access.service';

// Ece'nin karari (2026-08-24): "Yetkin yok" modali (role.guard.ts +
// PageAccessService) acikken kullanici ust menudeki baska bir sekmeye
// tiklayinca modal kapanmadan sessizce baska bir sayfaya gecebiliyordu -
// cunku app.ts eskiden HER navigasyon basinda bayragi onceden temizliyordu.
// Bu guard, ana '' rotasina canActivateChild olarak baglaniyor (bkz.
// app.routes.ts) - boylece TUM alt sayfalara gecisler icin, roleGuard'i olsun
// olmasin, calisir. Modal acikken (denied() true) her navigasyonu iptal eder;
// kullanici modal'i kapatmadan (dismiss -> clearDenied) hicbir yere gidemez.
// app.ts artik bayragi navigasyon basinda ONCEDEN temizlemiyor - roleGuard
// (yetkiliyse) veya dismiss() bayragi kendisi temizliyor, boylece bu guard'in
// gorecegi deger hep dogru/guncel.
export const blockNavWhileUnauthorizedModalGuard: CanActivateChildFn = () => {
  const pageAccessService = inject(PageAccessService);
  return !pageAccessService.denied();
};
