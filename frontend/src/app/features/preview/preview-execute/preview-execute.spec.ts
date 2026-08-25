import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PreviewExecute } from './preview-execute';

describe('PreviewExecute', () => {
  let component: PreviewExecute;
  let fixture: ComponentFixture<PreviewExecute>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewExecute],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PreviewExecute);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the last 5 runs on init for the "Son Çalıştırmalar" section', () => {
    fixture.detectChanges();

    httpMock.expectOne((req) => req.url.endsWith('/mappings')).flush([]);

    const runsReq = httpMock.expectOne((req) => req.url.endsWith('/run-history/page'));
    expect(runsReq.request.params.get('pageSize')).toBe('5');
    runsReq.flush({
      items: [
        {
          id: 'r1',
          mappingId: 'm1',
          mappingName: 'Maas Odeme',
          kind: 'Preview',
          fileNames: ['bordro.csv'],
          success: true,
          rowCount: 8,
          errorMessage: null,
          runAt: '2026-08-13T10:00:00Z',
        },
      ],
      totalCount: 1,
    });

    expect(component.recentRuns().length).toBe(1);

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.kind-badge.preview')).toBeTruthy();
    expect(el.querySelector('.status-badge.success')?.textContent).toContain('Başarılı');
  });

  it('renders a failed run with the failure badge and error detail', () => {
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.endsWith('/mappings')).flush([]);
    httpMock.expectOne((req) => req.url.endsWith('/run-history/page')).flush({
      items: [
        {
          id: 'r2',
          mappingId: 'm2',
          mappingName: 'Kredi Mapping',
          kind: 'Convert',
          fileNames: [],
          success: false,
          rowCount: null,
          errorMessage: 'Kaynak dosya okunamadı',
          runAt: new Date().toISOString(),
        },
      ],
      totalCount: 1,
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.kind-badge.convert')).toBeTruthy();
    expect(el.querySelector('.status-badge.failure')?.textContent).toContain('Başarısız');
    expect(el.querySelector('.status-error-detail')?.textContent).toContain('Kaynak dosya okunamadı');
  });
});
