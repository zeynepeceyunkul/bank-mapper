import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  it('navigates to check-email with the registered address on success', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.email = 'ece@vakifbank.com.tr';
    component.password = 'gecerliSifre1';
    component.passwordConfirm = 'gecerliSifre1';

    component.onSubmit();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/register'));
    expect(req.request.body).toEqual({
      email: 'ece@vakifbank.com.tr',
      password: 'gecerliSifre1',
      passwordConfirm: 'gecerliSifre1',
    });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(navigateSpy).toHaveBeenCalledWith(['/check-email'], {
      queryParams: { email: 'ece@vakifbank.com.tr' },
      replaceUrl: true,
    });
  });

  it('shows the backend error message (e.g. duplicate email) instead of navigating', () => {
    component.email = 'ece@vakifbank.com.tr';
    component.password = 'gecerliSifre1';
    component.passwordConfirm = 'gecerliSifre1';

    component.onSubmit();

    httpMock
      .expectOne((r) => r.url.endsWith('/auth/register'))
      .flush('Bu e-posta adresi zaten kayıtlı.', { status: 400, statusText: 'Bad Request' });

    expect(component.error()).toBe('Bu e-posta adresi zaten kayıtlı.');
  });

  it('does not submit when a field is empty', () => {
    component.email = 'ece@vakifbank.com.tr';
    component.password = '';
    component.passwordConfirm = '';

    component.onSubmit();

    httpMock.expectNone((r) => r.url.endsWith('/auth/register'));
  });
});
