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

  it('creates a direct source-field-to-target-field edge when dragging', () => {
    selectSourceAndTarget();

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    expect(component.edges()).toEqual([
      {
        id: expect.any(String),
        fromKind: 'SourceField',
        fromSourceSchemaId: 'src-1',
        fromFieldName: 'Ad',
        fromNodeId: null,
        toKind: 'TargetField',
        toNodeId: null,
        toPort: null,
        toFieldName: 'AdSoyad',
      },
    ]);
  });

  it('replaces the existing edge instead of duplicating it when a target field is rewired', () => {
    selectSourceAndTarget();

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());
    component.onSourceDotMouseDown('Soyad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    expect(component.edges().length).toBe(1);
    expect(component.edges()[0].fromFieldName).toBe('Soyad');
  });

  it('wires a functoid node between a source field and a target field', () => {
    selectSourceAndTarget();
    component.addFunctoidNode('Trim', 300, 80);
    const nodeId = component.functoidNodes()[0].id;

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onNodeInputMouseUp(nodeId, 'value', fakeMouseEvent());
    component.onNodeOutputMouseDown(nodeId, fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    expect(component.edges().length).toBe(2);
    expect(component.edges()[0]).toEqual(
      expect.objectContaining({ fromKind: 'SourceField', fromFieldName: 'Ad', toKind: 'NodeInput', toNodeId: nodeId, toPort: 'value' })
    );
    expect(component.edges()[1]).toEqual(
      expect.objectContaining({ fromKind: 'NodeOutput', fromNodeId: nodeId, toKind: 'TargetField', toFieldName: 'AdSoyad' })
    );
  });

  it('removing a functoid node also removes edges attached to it', () => {
    selectSourceAndTarget();
    component.addFunctoidNode('Trim', 300, 80);
    const nodeId = component.functoidNodes()[0].id;

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onNodeInputMouseUp(nodeId, 'value', fakeMouseEvent());

    expect(component.edges().length).toBe(1);

    component.removeFunctoidNode(nodeId);

    expect(component.functoidNodes()).toEqual([]);
    expect(component.edges()).toEqual([]);
  });

  it('adds and removes a constant node', () => {
    selectSourceAndTarget();
    component.addConstant();
    expect(component.constantNodes().length).toBe(1);

    const id = component.constantNodes()[0].id;
    component.setConstantValue(id, 'ZZZ');
    expect(component.constantNodes()[0].value).toBe('ZZZ');

    component.removeConstantNode(id);
    expect(component.constantNodes()).toEqual([]);
  });

  it('sends the graph shape when saving', () => {
    selectSourceAndTarget();

    component.onSourceDotMouseDown('Ad', fakeMouseEvent());
    component.onTargetDotMouseUp('AdSoyad', fakeMouseEvent());

    component.mappingName = 'Test Mapping';
    component.saveMapping();

    const request = httpMock.expectOne((req) => req.url.endsWith('/mappings'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body.sourceSchemas).toEqual([{ sourceSchemaId: 'src-1', alias: 'Test Source' }]);
    expect(request.request.body.edges.length).toBe(1);

    request.flush({
      id: 'm-1',
      name: 'Test Mapping',
      sourceSchemas: [{ sourceSchemaId: 'src-1', alias: 'Test Source' }],
      fileTypeId: sampleFileType.id,
      functoidNodes: [],
      constantNodes: [],
      edges: request.request.body.edges,
      createdAt: '',
      updatedAt: '',
      createdBy: null,
    });
  });

  it('shows an error and does not call the API when saving without any target-field connection', () => {
    selectSourceAndTarget();
    component.mappingName = 'Test Mapping';

    component.saveMapping();

    expect(component.saveError()).toBe('En az bir hedef alan bağlantısı olmalı.');
    httpMock.expectNone((req) => req.url.endsWith('/mappings'));
  });
});
