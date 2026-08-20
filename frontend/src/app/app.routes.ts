import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

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
    // Tek bir ust rotaya canActivate koyup gercek sayfalari children olarak
    // altina almak - ileride yeni bir sayfa eklenirse guard eklemeyi unutma
    // riskini ortadan kaldiriyor (backend'deki fallback authorization policy
    // ile ayni mantik, bkz. Program.cs).
    path: '',
    canActivate: [authGuard],
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
        path: 'mapping/edit/:id',
        loadComponent: () =>
          import('./features/mapping/mapping-editor/mapping-editor').then((m) => m.MappingEditor),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'preview',
        canActivate: [roleGuard],
        data: { roles: ['Admin'] },
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
        data: { roles: ['Admin', 'Approver'] },
        loadComponent: () =>
          import('./features/approvals/approval-queue/approval-queue').then((m) => m.ApprovalQueue),
      },
      {
        path: 'institutions',
        canActivate: [roleGuard],
        data: { roles: ['Admin', 'MappingDefiner'] },
        loadComponent: () =>
          import('./features/institutions/institution-list/institution-list').then((m) => m.InstitutionList),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['Admin'] },
        loadComponent: () => import('./features/users/user-list/user-list').then((m) => m.UserList),
      },
    ],
  },
];
