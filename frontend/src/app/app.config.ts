import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { routes } from './app.routes';
import { createTurkishPaginatorIntl } from './core/i18n/turkish-paginator-intl';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // Referans tasarimda alanlarin altinda hata/hint metni icin ayrilmis bos
    // bir bosluk yok - "dynamic" bu alani sadece gerekince (gercekten bir
    // hata/hint varken) ayirir, boylece kutular gereksiz yere uzamiyor.
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { subscriptSizing: 'dynamic' } },
    // mat-paginator varsayilan olarak Ingilizce ("Items per page" vb.) -
    // uygulama tamamen Turkce oldugu icin override ediyoruz.
    { provide: MatPaginatorIntl, useFactory: createTurkishPaginatorIntl },
  ]
};
