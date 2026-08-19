import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { VerifyEmail } from './verify-email';

describe('VerifyEmail', () => {
  let httpMock: HttpTestingController;

  function createWithParams(params: Record<string, string>): ComponentFixture<VerifyEmail> {
    TestBed.configureTestingModule({
      imports: [VerifyEmail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(VerifyEmail);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows success once the backend confirms the token', () => {
    const fixture = createWithParams({ email: 'ece@vakifbank.com.tr', token: 'gecerli-token' });
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/verify-email'));
    expect(req.request.body).toEqual({ email: 'ece@vakifbank.com.tr', token: 'gecerli-token' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.state()).toBe('success');
  });

  it('shows failure when the backend rejects the token', () => {
    const fixture = createWithParams({ email: 'ece@vakifbank.com.tr', token: 'suresi-dolmus' });
    const component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url.endsWith('/auth/verify-email'))
      .flush('Doğrulama bağlantısı geçersiz veya süresi dolmuş.', { status: 400, statusText: 'Bad Request' });

    expect(component.state()).toBe('failure');
  });

  it('shows failure immediately when the link is missing email or token', () => {
    const fixture = createWithParams({});
    const component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectNone((r) => r.url.endsWith('/auth/verify-email'));
    expect(component.state()).toBe('failure');
  });
});
