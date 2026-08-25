import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  let httpMock: HttpTestingController;

  function createWithParams(params: Record<string, string>): ComponentFixture<ResetPassword> {
    TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(params) } } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(ResetPassword);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the form and does not call the backend when the link has a valid email+token', () => {
    const fixture = createWithParams({ email: 'ece@vakifbank.com.tr', token: 'gecerli-token' });
    const component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectNone((r) => r.url.endsWith('/auth/reset-password'));
    expect(component.state()).toBe('form');
  });

  it('shows missingLink immediately when the link is missing email or token', () => {
    const fixture = createWithParams({});
    const component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectNone((r) => r.url.endsWith('/auth/reset-password'));
    expect(component.state()).toBe('missingLink');
  });

  it('submits email+token+new password and shows success on 204', () => {
    const fixture = createWithParams({ email: 'ece@vakifbank.com.tr', token: 'gecerli-token' });
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.password = 'yeniSifre1';
    component.passwordConfirm = 'yeniSifre1';

    component.onSubmit();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/reset-password'));
    expect(req.request.body).toEqual({
      email: 'ece@vakifbank.com.tr',
      token: 'gecerli-token',
      password: 'yeniSifre1',
      passwordConfirm: 'yeniSifre1',
    });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.state()).toBe('success');
  });

  it('shows the backend error message (e.g. expired token) instead of success', () => {
    const fixture = createWithParams({ email: 'ece@vakifbank.com.tr', token: 'suresi-dolmus' });
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.password = 'yeniSifre1';
    component.passwordConfirm = 'yeniSifre1';

    component.onSubmit();

    httpMock
      .expectOne((r) => r.url.endsWith('/auth/reset-password'))
      .flush('Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.', { status: 400, statusText: 'Bad Request' });

    expect(component.state()).toBe('form');
    expect(component.error()).toBe('Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
  });

  it('does not submit when a password field is empty', () => {
    const fixture = createWithParams({ email: 'ece@vakifbank.com.tr', token: 'gecerli-token' });
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.password = '';
    component.passwordConfirm = '';

    component.onSubmit();

    httpMock.expectNone((r) => r.url.endsWith('/auth/reset-password'));
  });
});
