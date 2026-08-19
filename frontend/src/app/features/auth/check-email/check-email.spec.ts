import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { CheckEmail } from './check-email';

describe('CheckEmail', () => {
  let component: CheckEmail;
  let fixture: ComponentFixture<CheckEmail>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckEmail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ email: 'ece@vakifbank.com.tr' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckEmail);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('reads the email address from the query param', () => {
    expect(component.email).toBe('ece@vakifbank.com.tr');
  });

  it('resends the verification email for that address', () => {
    component.resend();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/resend-verification'));
    expect(req.request.body).toEqual({ email: 'ece@vakifbank.com.tr' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.resent()).toBe(true);
  });

  it('shows the same "sent" state even if the backend call fails (no account-existence leak)', () => {
    component.resend();

    httpMock.expectOne((r) => r.url.endsWith('/auth/resend-verification')).flush(null, { status: 500, statusText: 'Error' });

    expect(component.resent()).toBe(true);
  });
});
