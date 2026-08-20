import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('loads mapping/schema counts and the recent mapping list on init', () => {
    fixture.detectChanges();

    const mappingsReq = httpMock.expectOne((req) => req.url.endsWith('/mappings/page'));
    expect(mappingsReq.request.params.get('pageSize')).toBe('10');
    expect(mappingsReq.request.params.get('sort')).toBe('RecentFirst');
    mappingsReq.flush({
      items: [{ id: 'm1', name: 'Maas Odeme Mapping', edges: [], updatedAt: '2026-08-01T10:00:00Z' }],
      totalCount: 24,
    });

    const schemasReq = httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page'));
    expect(schemasReq.request.params.get('pageSize')).toBe('1');
    schemasReq.flush({ items: [], totalCount: 13 });

    expect(component.mappingCount()).toBe(24);
    expect(component.schemaCount()).toBe(13);
    expect(component.recentMappings().length).toBe(1);
    expect(component.recentMappings()[0].name).toBe('Maas Odeme Mapping');
  });

  it('shows the last-updated mapping\'s relative time in the hero card', () => {
    fixture.detectChanges();

    httpMock.expectOne((req) => req.url.endsWith('/mappings/page')).flush({
      items: [
        { id: 'm1', name: 'Maas Odeme Mapping', edges: [], updatedAt: new Date().toISOString(), status: 'Approved', kurumIds: [] },
      ],
      totalCount: 1,
    });
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page')).flush({ items: [], totalCount: 0 });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Son güncelleme');
    expect(text).toContain('Az önce');
  });

  it('hides the last-activity block when there are no mappings yet', () => {
    fixture.detectChanges();

    httpMock.expectOne((req) => req.url.endsWith('/mappings/page')).flush({ items: [], totalCount: 0 });
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page')).flush({ items: [], totalCount: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hero-last-activity')).toBeNull();
  });

  it('shows an empty hint instead of the list when there are no mappings yet', () => {
    fixture.detectChanges();

    httpMock.expectOne((req) => req.url.endsWith('/mappings/page')).flush({ items: [], totalCount: 0 });
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas/page')).flush({ items: [], totalCount: 0 });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Henüz kayıtlı mapping yok.');
  });
});
