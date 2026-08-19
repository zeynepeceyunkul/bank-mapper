import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  it('navigates to the app on successful login', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    component.email = 'ece@vakifbank.com.tr';
    component.password = 'gecerliSifre1';

    component.onSubmit();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/login'));
    expect(req.request.body).toEqual({ email: 'ece@vakifbank.com.tr', password: 'gecerliSifre1' });
    req.flush({ token: 'abc', email: 'ece@vakifbank.com.tr' });

    expect(navigateSpy).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('shows the backend error message for wrong credentials', () => {
    component.email = 'ece@vakifbank.com.tr';
    component.password = 'yanlis';

    component.onSubmit();

    httpMock
      .expectOne((r) => r.url.endsWith('/auth/login'))
      .flush('E-posta veya şifre hatalı.', { status: 400, statusText: 'Bad Request' });

    expect(component.error()).toBe('E-posta veya şifre hatalı.');
    expect(component.submitting()).toBe(false);
  });

  it('does not submit when a field is empty', () => {
    component.email = '';
    component.password = '';

    component.onSubmit();

    httpMock.expectNone((r) => r.url.endsWith('/auth/login'));
  });
});
