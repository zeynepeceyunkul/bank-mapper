import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  let component: ForgotPassword;
  let fixture: ComponentFixture<ForgotPassword>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPassword);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('shows the "sent" state once the backend confirms, regardless of whether the account exists', () => {
    component.email = 'ece@vakifbank.com.tr';

    component.onSubmit();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/forgot-password'));
    expect(req.request.body).toEqual({ email: 'ece@vakifbank.com.tr' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.sent()).toBe(true);
  });

  it('shows the backend error message instead of the "sent" state when the request itself fails', () => {
    component.email = 'ece@vakifbank.com.tr';

    component.onSubmit();

    httpMock
      .expectOne((r) => r.url.endsWith('/auth/forgot-password'))
      .flush('İstek gönderilemedi.', { status: 500, statusText: 'Internal Server Error' });

    expect(component.sent()).toBe(false);
    expect(component.error()).toBe('İstek gönderilemedi.');
  });

  it('does not submit when the email is empty', () => {
    component.email = '';

    component.onSubmit();

    httpMock.expectNone((r) => r.url.endsWith('/auth/forgot-password'));
  });
});
