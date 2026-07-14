import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FunctoidPicker } from './functoid-picker';

describe('FunctoidPicker', () => {
  let component: FunctoidPicker;
  let fixture: ComponentFixture<FunctoidPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FunctoidPicker],
    }).compileComponents();

    fixture = TestBed.createComponent(FunctoidPicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
