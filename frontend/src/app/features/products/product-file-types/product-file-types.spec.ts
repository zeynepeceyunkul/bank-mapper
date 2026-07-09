import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductFileTypes } from './product-file-types';

describe('ProductFileTypes', () => {
  let component: ProductFileTypes;
  let fixture: ComponentFixture<ProductFileTypes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductFileTypes],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductFileTypes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
