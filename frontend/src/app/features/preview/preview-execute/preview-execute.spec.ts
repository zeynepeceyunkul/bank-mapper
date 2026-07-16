import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreviewExecute } from './preview-execute';

describe('PreviewExecute', () => {
  let component: PreviewExecute;
  let fixture: ComponentFixture<PreviewExecute>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewExecute],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PreviewExecute);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
