import { Routes } from '@angular/router';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mapping' },
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
];
