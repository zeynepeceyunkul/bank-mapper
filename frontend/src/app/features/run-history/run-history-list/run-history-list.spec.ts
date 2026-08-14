import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RunHistoryList } from './run-history-list';

const emptyPage = { items: [], totalCount: 0 };

describe('RunHistoryList', () => {
  let component: RunHistoryList;
  let fixture: ComponentFixture<RunHistoryList>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RunHistoryList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RunHistoryList);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('loads the first page with the default page size on init and stores the total count', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne((req) => req.url.endsWith('/run-history/page'));
    expect(req.request.params.get('pageIndex')).toBe('0');
    expect(req.request.params.get('pageSize')).toBe('10');

    req.flush({
      items: [
        {
          id: 'r1',
          mappingId: 'm1',
          mappingName: 'Maas Odeme',
          kind: 'Convert',
          fileNames: ['bordro.csv'],
          success: true,
          rowCount: 12,
          errorMessage: null,
          runAt: '2026-08-13T10:00:00Z',
        },
      ],
      totalCount: 1,
    });

    expect(component.runs().length).toBe(1);
    expect(component.totalCount()).toBe(1);
  });

  it('re-fetches with the new pageIndex/pageSize when the paginator emits a page event', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/run-history/page')).flush(emptyPage);

    component.onPageChange({ pageIndex: 1, pageSize: 25, length: 0, previousPageIndex: 0 });

    const req = httpMock.expectOne((req) => req.url.endsWith('/run-history/page'));
    expect(req.request.params.get('pageIndex')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('25');
    req.flush(emptyPage);
  });

  it('renders the correct kind/status badges for the data returned', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/run-history/page')).flush({
      items: [
        {
          id: 'r1',
          mappingId: 'm1',
          mappingName: 'Maas Odeme',
          kind: 'Convert',
          fileNames: ['bordro.csv'],
          success: true,
          rowCount: 12,
          errorMessage: null,
          runAt: '2026-08-13T10:00:00Z',
        },
      ],
      totalCount: 1,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.kind-badge.convert')?.textContent).toContain('Dönüştürme');
    expect(el.querySelector('.status-badge.success')?.textContent).toContain('Başarılı');
  });

  it('re-fetches with kind/success filters and resets to page 0 when a filter changes', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/run-history/page')).flush(emptyPage);

    component.onPageChange({ pageIndex: 2, pageSize: 10, length: 0, previousPageIndex: 0 });
    httpMock.expectOne((req) => req.url.endsWith('/run-history/page')).flush(emptyPage);

    component.onKindFilterChange('Preview');
    const kindReq = httpMock.expectOne((req) => req.url.endsWith('/run-history/page'));
    expect(kindReq.request.params.get('kind')).toBe('Preview');
    expect(kindReq.request.params.get('pageIndex')).toBe('0');
    kindReq.flush(emptyPage);

    component.onSuccessFilterChange('false');
    const successReq = httpMock.expectOne((req) => req.url.endsWith('/run-history/page'));
    expect(successReq.request.params.get('success')).toBe('false');
    successReq.flush(emptyPage);
  });

  it('builds detail text from row count or error message', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/run-history/page')).flush(emptyPage);

    expect(component.detailText({ success: true, rowCount: 7 } as never)).toBe('7 satır üretildi');
    expect(component.detailText({ success: false, errorMessage: 'Kaynak dosya okunamadı' } as never)).toBe(
      'Kaynak dosya okunamadı',
    );
  });
});
