import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'source-schemas' },
  {
    path: 'source-schemas',
    loadComponent: () =>
      import('./features/source-schemas/source-schema-list/source-schema-list').then(
        (m) => m.SourceSchemaList
      ),
  },
  {
    path: 'mapping',
    loadComponent: () =>
      import('./features/mapping/mapping-list/mapping-list').then((m) => m.MappingList),
  },
  {
    path: 'mapping/new',
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
