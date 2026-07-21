import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mapping' },
  {
    path: 'mapping',
    loadComponent: () =>
      import('./features/mapping/mapping-editor/mapping-editor').then((m) => m.MappingEditor),
  },
  {
    path: 'mapping/edit/:id',
    loadComponent: () =>
      import('./features/mapping/mapping-editor/mapping-editor').then((m) => m.MappingEditor),
  },
  {
    path: 'preview',
    loadComponent: () =>
      import('./features/preview/preview-execute/preview-execute').then((m) => m.PreviewExecute),
  },
];
