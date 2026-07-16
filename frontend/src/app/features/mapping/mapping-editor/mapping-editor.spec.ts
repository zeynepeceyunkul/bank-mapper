import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MappingEditor } from './mapping-editor';
import { FileType } from '../../../core/models/file-type.model';
import { SourceSchema } from '../../../core/models/source-schema.model';

const fakeMouseEvent = () =>
  ({ preventDefault: () => {}, stopPropagation: () => {}, clientX: 0, clientY: 0 }) as unknown as MouseEvent;

const sampleSourceSchema: SourceSchema = {
  id: 'src-1',
  name: 'Test Source',
  fileFormat: 'Csv',
  fields: [
    { name: 'Ad', type: 'string', order: 1, startIndex: null, length: null },
    { name: 'Soyad', type: 'string', order: 2, startIndex: null, length: null },
  ],
  formatOptions: { hasHeader: true, delimiter: ',' },
};

const sampleFileType: FileType = {
  id: 'ft-1',
  productId: 'prod-1',
  code: 'TEST_FILE',
  name: 'Test File',
  targetFields: [{ name: 'AdSoyad', type: 'string', order: 1, length: 50 }],
};

describe('MappingEditor', () => {
  let component: MappingEditor;
  let fixture: ComponentFixture<MappingEditor>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingEditor],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MappingEditor);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    httpMock.expectOne((req) => req.url.endsWith('/products')).flush([]);
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas')).flush([]);
    httpMock.expectOne((req) => req.url.endsWith('/functoids')).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function selectSourceAndTarget(): void {
    component.sourceSchemas.set([sampleSourceSchema]);
    component.fileTypes.set([sampleFileType]);
    component.selectedSourceSchemaId = sampleSourceSchema.id;
    component.selectedFileTypeId = sampleFileType.id;
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates a connection when dragging from a source field to a target field', () => {
    selectSourceAndTarget();

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    expect(component.connections()).toEqual([{ sourceField: 'Ad', targetField: 'AdSoyad' }]);
  });

  it('does not create a duplicate connection for the same source/target pair', () => {
    selectSourceAndTarget();

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());
    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    expect(component.connections().length).toBe(1);
  });

  it('removes a connection and clears its functoid chain once no source is left mapped to that target', () => {
    selectSourceAndTarget();

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    component.functoidFormCode = 'Trim';
    component.addFunctoid('AdSoyad');
    expect(component.functoidsFor('AdSoyad').length).toBe(1);

    component.removeConnection(0);

    expect(component.connections()).toEqual([]);
    expect(component.functoidsFor('AdSoyad')).toEqual([]);
  });

  it('adds and removes a functoid from a target field chain', () => {
    selectSourceAndTarget();
    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    component.functoidFormCode = 'Trim';
    component.addFunctoid('AdSoyad');
    expect(component.functoidsFor('AdSoyad')).toEqual([{ type: 'Trim', order: 1, params: {} }]);

    component.removeFunctoid('AdSoyad', 0);
    expect(component.functoidsFor('AdSoyad')).toEqual([]);
  });

  it('groups multiple source fields mapped to the same target into one FieldMapping when saving', () => {
    selectSourceAndTarget();

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());
    component.onSourceDotMouseDown('Soyad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    component.mappingName = 'Test Mapping';
    component.saveMapping();

    const request = httpMock.expectOne((req) => req.url.endsWith('/mappings'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body.fieldMappings).toEqual([
      { targetField: 'AdSoyad', sourceFields: ['Ad', 'Soyad'], functoidChain: [] },
    ]);

    request.flush({
      id: 'm-1',
      name: 'Test Mapping',
      sourceSchemaId: sampleSourceSchema.id,
      fileTypeId: sampleFileType.id,
      fieldMappings: [],
      createdAt: '',
      updatedAt: '',
      createdBy: null,
    });
  });

  it('shows an error and does not call the API when saving without any connection', () => {
    selectSourceAndTarget();
    component.mappingName = 'Test Mapping';

    component.saveMapping();

    expect(component.saveError()).toBe('En az bir bağlantı çizmelisin.');
    httpMock.expectNone((req) => req.url.endsWith('/mappings'));
  });
});
