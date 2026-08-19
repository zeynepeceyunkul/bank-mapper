import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { MappingList } from './mapping-list';

const emptyPage = { items: [], totalCount: 0 };

describe('MappingList', () => {
  let component: MappingList;
  let fixture: ComponentFixture<MappingList>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MappingList);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/mappings/page')).flush(emptyPage);
    expect(component).toBeTruthy();
  });

  it('loads the first page with the default page size on init and stores the total count', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((req) => req.url.endsWith('/mappings/page'));
    expect(req.request.params.get('pageIndex')).toBe('0');
    expect(req.request.params.get('pageSize')).toBe('10');

    req.flush({ items: [{ id: 'm1', name: 'Test', edges: [], updatedAt: '2026-01-01' }], totalCount: 24 });

    expect(component.mappings().length).toBe(1);
    expect(component.totalCount()).toBe(24);
  });

  it('re-fetches with the new pageIndex/pageSize when the paginator emits a page event', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/mappings/page')).flush(emptyPage);

    component.onPageChange({ pageIndex: 2, pageSize: 25, length: 0, previousPageIndex: 0 });

    const req = httpMock.expectOne((req) => req.url.endsWith('/mappings/page'));
    expect(req.request.params.get('pageIndex')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('25');
    req.flush(emptyPage);
  });

  it('defaults to RecentFirst and re-fetches page 0 with the new sort when it changes', () => {
    fixture.detectChanges();
    const initialReq = httpMock.expectOne((req) => req.url.endsWith('/mappings/page'));
    expect(initialReq.request.params.get('sort')).toBe('RecentFirst');
    initialReq.flush(emptyPage);

    component.onPageChange({ pageIndex: 2, pageSize: 25, length: 0, previousPageIndex: 0 });
    httpMock.expectOne((req) => req.url.endsWith('/mappings/page')).flush(emptyPage);

    component.onSortChange('NameAscending');

    const req = httpMock.expectOne((req) => req.url.endsWith('/mappings/page'));
    expect(req.request.params.get('sort')).toBe('NameAscending');
    // Sort degisince sayfa 0'a donmeli - eski sayfada (orn. 3. sayfa) yeni
    // sirada hic kayit olmayabilir.
    expect(req.request.params.get('pageIndex')).toBe('0');
    req.flush(emptyPage);
  });

  it('debounces search input and resets to page 0 before re-fetching', () => {
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      httpMock.expectOne((req) => req.url.endsWith('/mappings/page')).flush(emptyPage);

      component.onPageChange({ pageIndex: 2, pageSize: 25, length: 0, previousPageIndex: 0 });
      httpMock.expectOne((req) => req.url.endsWith('/mappings/page')).flush(emptyPage);

      component.onSearchChange('odeme');
      httpMock.expectNone((req) => req.url.endsWith('/mappings/page'));

      vi.advanceTimersByTime(300);

      const req = httpMock.expectOne((req) => req.url.endsWith('/mappings/page'));
      expect(req.request.params.get('search')).toBe('odeme');
      expect(req.request.params.get('pageIndex')).toBe('0');
      req.flush(emptyPage);
    } finally {
      vi.useRealTimers();
    }
  });
});
