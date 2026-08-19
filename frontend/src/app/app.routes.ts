import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
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
    loadComponent: () =>
      import('./features/preview/preview-execute/preview-execute').then((m) => m.PreviewExecute),
  },
  {
    path: 'run-history',
    loadComponent: () =>
      import('./features/run-history/run-history-list/run-history-list').then((m) => m.RunHistoryList),
  },
];
