import { MatPaginatorIntl } from '@angular/material/paginator';

// mat-paginator varsayilan olarak Ingilizce string'lerle geliyor
// ("Items per page", "1 - 10 of 24" vb.) - uygulamanin geri kalani tamamen
// Turkce oldugu icin bunu override ediyoruz.
export function createTurkishPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();

  intl.itemsPerPageLabel = 'Sayfa başına öğe:';
  intl.nextPageLabel = 'Sonraki sayfa';
  intl.previousPageLabel = 'Önceki sayfa';
  intl.firstPageLabel = 'İlk sayfa';
  intl.lastPageLabel = 'Son sayfa';

  intl.getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 / ${length}`;
    }

    const startIndex = page * pageSize;
    const endIndex = startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;
    return `${startIndex + 1} – ${endIndex} / ${length}`;
  };

  return intl;
}
