import { Component, EventEmitter, Input, Output } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { MappingEditor } from './mapping-editor';
import { MappingCanvas, MappingCanvasSnapshot } from '../mapping-canvas/mapping-canvas';
import { FileType } from '../../../core/models/file-type.model';
import { SourceSchema } from '../../../core/models/source-schema.model';

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

const emptySnapshot = (): MappingCanvasSnapshot => ({ sourceSchemas: [], functoidNodes: [], constantNodes: [], edges: [] });

// mapping-editor artık canvas'ın kendisini değil, orkestrasyonu (ürün/dosya
// tipi seçimi, kaydetme, snapshot gate'i) test ediyor. Gerçek X6 canvas'ı
// mapping-canvas.spec.ts'de ayrıca test ediliyor; burada onun yerine ince bir
// sahte (fake) canvas kullanılıyor.
@Component({ selector: 'app-mapping-canvas', template: '' })
class FakeMappingCanvas {
  @Input() functoidDefinitions: unknown[] = [];
  @Input() targetFileType: FileType | null = null;
  @Input() allSourceSchemas: SourceSchema[] = [];
  @Input() initialSnapshot: MappingCanvasSnapshot | null = null;
  @Output() readonly graphChanged = new EventEmitter<void>();

  snapshot: MappingCanvasSnapshot = emptySnapshot();

  getSnapshot(): MappingCanvasSnapshot {
    return this.snapshot;
  }

  getSourceSchemaIds(): string[] {
    return this.snapshot.sourceSchemas.map((s) => s.sourceSchemaId);
  }

  describeEdges(): { id: string; from: string; to: string }[] {
    return this.snapshot.edges.map((e) => ({ id: e.id, from: e.fromFieldName ?? '?', to: e.toFieldName ?? '?' }));
  }

  addSourceSchema(schema: SourceSchema, x: number, y: number): void {
    this.snapshot = {
      ...this.snapshot,
      sourceSchemas: [...this.snapshot.sourceSchemas, { sourceSchemaId: schema.id, joinKeyField: null, positionX: x, positionY: y }],
    };
    this.graphChanged.emit();
  }

  addConstant(x: number, y: number): void {
    this.snapshot = {
      ...this.snapshot,
      constantNodes: [...this.snapshot.constantNodes, { id: 'const-1', value: '', positionX: x, positionY: y }],
    };
    this.graphChanged.emit();
  }

  removeEdge(id: string): void {
    this.snapshot = { ...this.snapshot, edges: this.snapshot.edges.filter((e) => e.id !== id) };
    this.graphChanged.emit();
  }
}

describe('MappingEditor', () => {
  let component: MappingEditor;
  let fixture: ComponentFixture<MappingEditor>;
  let httpMock: HttpTestingController;

  function fakeCanvas(): FakeMappingCanvas {
    return fixture.debugElement.query(By.directive(FakeMappingCanvas)).componentInstance as FakeMappingCanvas;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingEditor],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    })
      .overrideComponent(MappingEditor, {
        remove: { imports: [MappingCanvas] },
        add: { imports: [FakeMappingCanvas] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MappingEditor);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();

    httpMock.expectOne((req) => req.url.endsWith('/products')).flush([]);
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas')).flush([sampleSourceSchema]);
    httpMock.expectOne((req) => req.url.endsWith('/functoids')).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function selectTarget(): void {
    component.sourceSchemas.set([sampleSourceSchema]);
    component.fileTypes.set([sampleFileType]);
    component.selectedFileTypeId = sampleFileType.id;
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('gates the canvas behind a selected file type', () => {
    expect(fixture.debugElement.query(By.directive(FakeMappingCanvas))).toBeNull();
    selectTarget();
    expect(fixture.debugElement.query(By.directive(FakeMappingCanvas))).not.toBeNull();
  });

  it('only reveals the initial snapshot once source schemas and functoid defs have loaded', () => {
    expect(component.effectiveSnapshot()).toBeNull();

    component.sourceSchemasLoaded.set(true);
    expect(component.effectiveSnapshot()).toBeNull();

    component.functoidDefinitionsLoaded.set(true);
    expect(component.effectiveSnapshot()).toBeNull();
  });

  it('delegates add-source-schema to the canvas and tracks used schema ids via graphChanged', () => {
    selectTarget();
    component.newSourceSchemaId = sampleSourceSchema.id;

    component.addSourceSchema();
    fixture.detectChanges();

    expect(fakeCanvas().getSourceSchemaIds()).toEqual(['src-1']);
    expect(component.usedSourceSchemaIds()).toEqual(['src-1']);
    expect(component.availableSourceSchemasToAdd).toEqual([]);
    expect(component.newSourceSchemaId).toBe('');
  });

  it('delegates add-constant and remove-edge to the canvas', () => {
    selectTarget();
    component.addConstant();
    expect(fakeCanvas().getSnapshot().constantNodes.length).toBe(1);

    fakeCanvas().snapshot = {
      ...fakeCanvas().snapshot,
      edges: [
        {
          id: 'e1',
          fromKind: 'SourceField',
          fromSourceSchemaId: 'src-1',
          fromFieldName: 'Ad',
          fromNodeId: null,
          toKind: 'TargetField',
          toNodeId: null,
          toPort: null,
          toFieldName: 'AdSoyad',
        },
      ],
    };
    component.removeEdge('e1');
    expect(fakeCanvas().getSnapshot().edges).toEqual([]);
  });

  it('shows an error and does not call the API when saving without any target-field connection', () => {
    selectTarget();
    component.mappingName = 'Test Mapping';

    component.saveMapping();

    expect(component.saveError()).toBe('En az bir hedef alan bağlantısı olmalı.');
    httpMock.expectNone((req) => req.url.endsWith('/mappings'));
  });

  it('sends the graph snapshot from the canvas when saving', () => {
    selectTarget();
    fakeCanvas().snapshot = {
      sourceSchemas: [{ sourceSchemaId: 'src-1', joinKeyField: null, positionX: 20, positionY: 20 }],
      functoidNodes: [],
      constantNodes: [],
      edges: [
        {
          id: 'e1',
          fromKind: 'SourceField',
          fromSourceSchemaId: 'src-1',
          fromFieldName: 'Ad',
          fromNodeId: null,
          toKind: 'TargetField',
          toNodeId: null,
          toPort: null,
          toFieldName: 'AdSoyad',
        },
      ],
    };

    component.mappingName = 'Test Mapping';
    component.saveMapping();

    const request = httpMock.expectOne((req) => req.url.endsWith('/mappings'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body.sourceSchemas).toEqual([
      { sourceSchemaId: 'src-1', alias: 'Test Source', joinKeyField: null, positionX: 20, positionY: 20 },
    ]);
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

  it('requires a join key from every schema before saving when multiple source schemas are used', () => {
    selectTarget();
    fakeCanvas().snapshot = {
      sourceSchemas: [
        { sourceSchemaId: 'src-1', joinKeyField: null, positionX: 20, positionY: 20 },
        { sourceSchemaId: 'src-2', joinKeyField: null, positionX: 50, positionY: 50 },
      ],
      functoidNodes: [],
      constantNodes: [],
      edges: [
        {
          id: 'e1',
          fromKind: 'SourceField',
          fromSourceSchemaId: 'src-1',
          fromFieldName: 'Ad',
          fromNodeId: null,
          toKind: 'TargetField',
          toNodeId: null,
          toPort: null,
          toFieldName: 'AdSoyad',
        },
      ],
    };
    component.mappingName = 'Multi Schema Mapping';

    component.saveMapping();

    expect(component.saveError()).toBe(
      'Birden fazla kaynak şema kullanılıyorsa her biri için birleştirme anahtarı seçilmelidir.'
    );
    httpMock.expectNone((req) => req.url.endsWith('/mappings'));
  });
});
