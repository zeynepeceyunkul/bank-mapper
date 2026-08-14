import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { SourceSchemaList } from './source-schema-list';

const emptyPage = { items: [], totalCount: 0 };

describe('SourceSchemaList', () => {
  let component: SourceSchemaList;
  let fixture: ComponentFixture<SourceSchemaList>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceSchemaList],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SourceSchemaList);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page')).flush(emptyPage);
    expect(component).toBeTruthy();
  });

  it('loads the first page with the default page size on init and stores the total count', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page'));
    expect(req.request.params.get('pageIndex')).toBe('0');
    expect(req.request.params.get('pageSize')).toBe('10');

    req.flush({
      items: [{ id: 's1', name: 'Test', fileFormat: 'Csv', fields: [], formatOptions: { hasHeader: true, delimiter: ',' } }],
      totalCount: 13,
    });

    expect(component.schemas().length).toBe(1);
    expect(component.totalCount()).toBe(13);
  });

  it('re-fetches with the new pageIndex/pageSize when the paginator emits a page event', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page')).flush(emptyPage);

    component.onPageChange({ pageIndex: 1, pageSize: 5, length: 0, previousPageIndex: 0 });

    const req = httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page'));
    expect(req.request.params.get('pageIndex')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('5');
    req.flush(emptyPage);
  });

  it('defaults to RecentFirst and re-fetches page 0 with the new sort when it changes', () => {
    fixture.detectChanges();
    const initialReq = httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page'));
    expect(initialReq.request.params.get('sort')).toBe('RecentFirst');
    initialReq.flush(emptyPage);

    component.onPageChange({ pageIndex: 1, pageSize: 5, length: 0, previousPageIndex: 0 });
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page')).flush(emptyPage);

    component.onSortChange('NameAscending');

    const req = httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page'));
    expect(req.request.params.get('sort')).toBe('NameAscending');
    expect(req.request.params.get('pageIndex')).toBe('0');
    req.flush(emptyPage);
  });

  it('debounces search input and resets to page 0 before re-fetching', () => {
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page')).flush(emptyPage);

      component.onPageChange({ pageIndex: 1, pageSize: 5, length: 0, previousPageIndex: 0 });
      httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page')).flush(emptyPage);

      component.onSearchChange('bordro');
      httpMock.expectNone((req) => req.url.endsWith('/source-schemas/page'));

      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page'));
      expect(req.request.params.get('search')).toBe('bordro');
      expect(req.request.params.get('pageIndex')).toBe('0');
      req.flush(emptyPage);
    } finally {
      vi.useRealTimers();
    }
  });
});
