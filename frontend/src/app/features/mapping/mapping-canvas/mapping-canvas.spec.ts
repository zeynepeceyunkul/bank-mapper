import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MappingCanvas, MappingCanvasSnapshot } from './mapping-canvas';
import { FileType } from '../../../core/models/file-type.model';
import { SourceSchema } from '../../../core/models/source-schema.model';
import { FunctoidDefinition } from '../../../core/models/functoid.model';

const targetFileType: FileType = {
  id: 'ft-1',
  productId: 'prod-1',
  code: 'TEST_FILE',
  name: 'Test File',
  targetFields: [
    { name: 'AdSoyad', type: 'string', order: 1, length: 50 },
    { name: 'NetTutar', type: 'string', order: 2, length: 10 },
  ],
};

const sourceSchema: SourceSchema = {
  id: 'src-1',
  name: 'Test Source',
  fileFormat: 'Csv',
  fields: [
    { name: 'Ad', type: 'string', order: 1, startIndex: null, length: null },
    { name: 'Soyad', type: 'string', order: 2, startIndex: null, length: null },
  ],
  formatOptions: { hasHeader: true, delimiter: ',' },
};

const trimDefinition: FunctoidDefinition = {
  code: 'Trim',
  name: 'Trim',
  parameters: [],
  inputPorts: [{ name: 'value', label: 'Değer' }],
};

describe('MappingCanvas', () => {
  let component: MappingCanvas;
  let fixture: ComponentFixture<MappingCanvas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MappingCanvas] }).compileComponents();
    fixture = TestBed.createComponent(MappingCanvas);
    component = fixture.componentInstance;
    component.functoidDefinitions = [trimDefinition];
    component.allSourceSchemas = [sourceSchema];
    component.targetFileType = targetFileType;
    fixture.detectChanges();
  });

  it('creates the graph and renders the target node', () => {
    expect(component.getSourceSchemaIds()).toEqual([]);
    expect(component.getSnapshot().sourceSchemas).toEqual([]);
  });

  it('adds and removes a source schema', () => {
    component.addSourceSchema(sourceSchema, 20, 20);
    expect(component.getSourceSchemaIds()).toEqual(['src-1']);

    component.removeSourceSchema('src-1');
    expect(component.getSourceSchemaIds()).toEqual([]);
  });

  it('adds a constant node and reflects it in the snapshot', () => {
    component.addConstant(100, 100);
    const snapshot = component.getSnapshot();
    expect(snapshot.constantNodes.length).toBe(1);
    expect(snapshot.constantNodes[0].value).toBe('');
  });

  it('round-trips a snapshot through loadSnapshot/getSnapshot (private API via initialSnapshot input)', () => {
    const snapshot: MappingCanvasSnapshot = {
      sourceSchemas: [{ sourceSchemaId: 'src-1', joinKeyField: null, positionX: 20, positionY: 20 }],
      functoidNodes: [{ id: 'fn-1', functoidCode: 'Trim', params: null, positionX: 300, positionY: 80 }],
      constantNodes: [],
      edges: [
        {
          id: 'e1',
          fromKind: 'SourceField',
          fromSourceSchemaId: 'src-1',
          fromFieldName: 'Ad',
          fromNodeId: null,
          toKind: 'NodeInput',
          toNodeId: 'fn-1',
          toPort: 'value',
          toFieldName: null,
        },
        {
          id: 'e2',
          fromKind: 'NodeOutput',
          fromSourceSchemaId: null,
          fromFieldName: null,
          fromNodeId: 'fn-1',
          toKind: 'TargetField',
          toNodeId: null,
          toPort: null,
          toFieldName: 'AdSoyad',
        },
      ],
    };

    component.initialSnapshot = snapshot;
    fixture.detectChanges();

    const result = component.getSnapshot();
    expect(result.sourceSchemas).toEqual(snapshot.sourceSchemas);
    expect(result.functoidNodes).toEqual(snapshot.functoidNodes);
    expect(result.edges).toEqual(snapshot.edges);
    expect(component.describeEdges()).toEqual([
      { id: 'e1', from: 'Ad', to: 'Trim.value' },
      { id: 'e2', from: 'Trim', to: 'AdSoyad' },
    ]);
  });
});
