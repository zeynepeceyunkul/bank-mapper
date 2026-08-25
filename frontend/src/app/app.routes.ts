import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { blockNavWhileUnauthorizedModalGuard } from './core/guards/block-nav-while-unauthorized-modal.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'check-email',
    loadComponent: () => import('./features/auth/check-email/check-email').then((m) => m.CheckEmail),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./features/auth/verify-email/verify-email').then((m) => m.VerifyEmail),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    // verify-email gibi guestGuard'siz - e-postadaki linke tiklandiginda
    // oturum acilmis olabilir/olmayabilir, sorgu parametreleriyle (email+token)
    // calisiyor.
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    // Tek bir ust rotaya canActivate koyup gercek sayfalari children olarak
    // altina almak - ileride yeni bir sayfa eklenirse guard eklemeyi unutma
    // riskini ortadan kaldiriyor (backend'deki fallback authorization policy
    // ile ayni mantik, bkz. Program.cs).
    path: '',
    canActivate: [authGuard],
    // "Yetkin yok" modali acikken baska bir sekmeye gecisi engellemek icin -
    // bkz. block-nav-while-unauthorized-modal.guard.ts. canActivateChild
    // olarak TEK bir yerde tanimlaniyor, her child route'a ayri ayri
    // eklemeye gerek kalmadan hepsini kapsiyor (roleGuard'i olmayanlar dahil).
    canActivateChild: [blockNavWhileUnauthorizedModalGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'mapping',
        loadComponent: () =>
          import('./features/mapping/mapping-editor/mapping-editor').then((m) => m.MappingEditor),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        // Sadece bu rota kisitli - var olan bir mapping'i canvas'a acmak.
        // "/mapping" (bos canvas + gomulu "Kayitli Mapping'ler" paneli) ve
        // hicbir link/routerLink hedefi bilerek degistirilmedi (Ece'nin
        // karari, 2026-08-22: arayuzdeki linklere dokunulmayacak) - sadece
        // "Duzenle"ye basinca yetkisiz modali cikmasi gerekiyordu.
        path: 'mapping/edit/:id',
        canActivate: [roleGuard],
        data: { roles: ['SuperAdmin', 'MappingDefiner', 'Approver'] },
        loadComponent: () =>
          import('./features/mapping/mapping-editor/mapping-editor').then((m) => m.MappingEditor),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        // Eskiden sadece Admin - Ece'nin karari (2026-08-22): mapping/edit/:id
        // ile ayni rol seti (Admin+MappingDefiner+Approver), cunku bir
        // mapping'i tanimlayan/onaylayan kisinin de kendi cikisini
        // onizleyebilmesi mantikli. Backend'deki "Convert" policy'si de ayni
        // sekilde genisletildi (bkz. Program.cs).
        path: 'preview',
        canActivate: [roleGuard],
        data: { roles: ['SuperAdmin', 'MappingDefiner', 'Approver'] },
        loadComponent: () =>
          import('./features/preview/preview-execute/preview-execute').then((m) => m.PreviewExecute),
      },
      {
        path: 'run-history',
        loadComponent: () =>
          import('./features/run-history/run-history-list/run-history-list').then((m) => m.RunHistoryList),
      },
      {
        path: 'approvals',
        canActivate: [roleGuard],
        data: { roles: ['SuperAdmin', 'Approver'] },
        loadComponent: () =>
          import('./features/approvals/approval-queue/approval-queue').then((m) => m.ApprovalQueue),
      },
      {
        // roleGuard KALDIRILDI (2026-08-22) - backend zaten okumayi herkese
        // acik tutuyor (GET /api/institutions'ta [Authorize] yok), ve
        // Viewer/Approver ayni kurum isimlerini Mapping listesindeki "Kurum"
        // sutununda zaten roll kontrolsuz goruyordu - kendi sayfasinda tam
        // engellemek tutarsizdi. Mapping/Gecmis gibi artik herkese acik,
        // gercek kisitlama zaten institution-list.ts'teki
        // canManageInstitutions() ile Ekle/Sil aksiyonlarinda var.
        path: 'institutions',
        loadComponent: () =>
          import('./features/institutions/institution-list/institution-list').then((m) => m.InstitutionList),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['SuperAdmin'] },
        loadComponent: () => import('./features/users/user-list/user-list').then((m) => m.UserList),
      },
    ],
  },
];
