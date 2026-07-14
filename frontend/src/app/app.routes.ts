import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'products',
    loadComponent: () =>
      import('./features/products/product-file-types/product-file-types').then(
        (m) => m.ProductFileTypes
      ),
  },
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
];
