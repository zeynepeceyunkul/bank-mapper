import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourceSchemaList } from './source-schema-list';

describe('SourceSchemaList', () => {
  let component: SourceSchemaList;
  let fixture: ComponentFixture<SourceSchemaList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceSchemaList],
    }).compileComponents();

    fixture = TestBed.createComponent(SourceSchemaList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
