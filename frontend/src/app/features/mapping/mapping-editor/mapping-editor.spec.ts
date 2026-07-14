import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MappingEditor } from './mapping-editor';

describe('MappingEditor', () => {
  let component: MappingEditor;
  let fixture: ComponentFixture<MappingEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingEditor],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MappingEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
