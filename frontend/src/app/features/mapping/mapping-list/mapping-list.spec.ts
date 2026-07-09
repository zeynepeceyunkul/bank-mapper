import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MappingList } from './mapping-list';

describe('MappingList', () => {
  let component: MappingList;
  let fixture: ComponentFixture<MappingList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingList],
    }).compileComponents();

    fixture = TestBed.createComponent(MappingList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
