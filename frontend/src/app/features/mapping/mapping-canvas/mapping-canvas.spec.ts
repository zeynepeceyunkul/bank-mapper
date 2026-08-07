import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
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

const concatDefinition: FunctoidDefinition = {
  code: 'Concat',
  name: 'Concat (Birleştir)',
  parameters: [{ key: 'separator', label: 'Ayraç', type: 'string' }],
  inputPorts: [
    { name: 'value1', label: 'Değer 1' },
    { name: 'value2', label: 'Değer 2' },
  ],
};

describe('MappingCanvas', () => {
  let component: MappingCanvas;
  let fixture: ComponentFixture<MappingCanvas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MappingCanvas] }).compileComponents();
    fixture = TestBed.createComponent(MappingCanvas);
    component = fixture.componentInstance;
    component.functoidDefinitions = [trimDefinition, concatDefinition];
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

  it('ignores a second addSourceSchema call while one is already present (single-source only)', () => {
    const otherSchema: SourceSchema = { ...sourceSchema, id: 'src-2', name: 'Other Source' };

    component.addSourceSchema(sourceSchema, 20, 20);
    component.addSourceSchema(otherSchema, 60, 60);

    expect(component.getSourceSchemaIds()).toEqual(['src-1']);
  });

  it('adds a constant node and reflects it in the snapshot', () => {
    component.addConstant(100, 100);
    const snapshot = component.getSnapshot();
    expect(snapshot.constantNodes.length).toBe(1);
    expect(snapshot.constantNodes[0].value).toBe('');
  });

  it('round-trips a snapshot through loadSnapshot/getSnapshot (private API via initialSnapshot input)', () => {
    const snapshot: MappingCanvasSnapshot = {
      sourceSchemas: [{ sourceSchemaId: 'src-1', positionX: 20, positionY: 20 }],
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

  it('shows suggested matches as overlays and accepting one creates a real edge', () => {
    component.addSourceSchema(sourceSchema, 20, 20);

    component.showSuggestions([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);

    expect(component.suggestions().length).toBe(1);
    expect(component.getSnapshot().edges.length).toBe(0);

    const graphChangedSpy = vi.spyOn(component.graphChanged, 'emit');
    component.acceptSuggestion(component.suggestions()[0]);

    expect(component.suggestions().length).toBe(0);
    const edges = component.getSnapshot().edges;
    expect(edges.length).toBe(1);
    expect(edges[0].fromFieldName).toBe('Ad');
    expect(edges[0].toFieldName).toBe('AdSoyad');
    expect(graphChangedSpy).toHaveBeenCalled();
  });

  it('rejecting a suggestion removes it without creating an edge', () => {
    component.addSourceSchema(sourceSchema, 20, 20);
    component.showSuggestions([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);

    component.rejectSuggestion(component.suggestions()[0]);

    expect(component.suggestions().length).toBe(0);
    expect(component.getSnapshot().edges.length).toBe(0);
  });

  it('does not suggest a match for a field that already has a real connection', () => {
    component.addSourceSchema(sourceSchema, 20, 20);
    component.showSuggestions([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);
    component.acceptSuggestion(component.suggestions()[0]);

    component.showSuggestions([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);

    expect(component.suggestions().length).toBe(0);
  });

  it('ignores an unknown field name in a suggestion instead of throwing', () => {
    component.addSourceSchema(sourceSchema, 20, 20);

    component.showSuggestions([{ sourceFields: ['BilinmeyenAlan'], targetField: 'AdSoyad', functoidCode: null }]);

    expect(component.suggestions()).toEqual([]);
  });

  it('shows a concat suggestion as a ghost functoid box with three lines', () => {
    component.addSourceSchema(sourceSchema, 20, 20);

    component.showSuggestions([{ sourceFields: ['Ad', 'Soyad'], targetField: 'AdSoyad', functoidCode: 'Concat' }]);

    expect(component.suggestions().length).toBe(1);
    const overlay = component.suggestions()[0];
    expect(overlay.functoidCode).toBe('Concat');
    expect(overlay.box).not.toBeNull();
    expect(overlay.lines.length).toBe(3);
  });

  it('accepting a concat suggestion creates a real functoid node and three edges', () => {
    component.addSourceSchema(sourceSchema, 20, 20);
    component.showSuggestions([{ sourceFields: ['Ad', 'Soyad'], targetField: 'AdSoyad', functoidCode: 'Concat' }]);

    const graphChangedSpy = vi.spyOn(component.graphChanged, 'emit');
    component.acceptSuggestion(component.suggestions()[0]);

    expect(component.suggestions().length).toBe(0);
    const snapshot = component.getSnapshot();
    expect(snapshot.functoidNodes.length).toBe(1);
    expect(snapshot.functoidNodes[0].functoidCode).toBe('Concat');
    expect(snapshot.edges.length).toBe(3);
    expect(graphChangedSpy).toHaveBeenCalled();

    const described = component.describeEdges();
    expect(described).toContainEqual({ id: expect.any(String), from: 'Ad', to: 'Concat.value1' });
    expect(described).toContainEqual({ id: expect.any(String), from: 'Soyad', to: 'Concat.value2' });
    expect(described).toContainEqual({ id: expect.any(String), from: 'Concat', to: 'AdSoyad' });
  });

  it('rejecting a concat suggestion creates no node or edge', () => {
    component.addSourceSchema(sourceSchema, 20, 20);
    component.showSuggestions([{ sourceFields: ['Ad', 'Soyad'], targetField: 'AdSoyad', functoidCode: 'Concat' }]);

    component.rejectSuggestion(component.suggestions()[0]);

    expect(component.suggestions().length).toBe(0);
    const snapshot = component.getSnapshot();
    expect(snapshot.functoidNodes.length).toBe(0);
    expect(snapshot.edges.length).toBe(0);
  });

  // Not: gercek Dnd suruklemesini bir MouseEvent'le simule etmek yerine, "bir
  // functoid X6 grafigine eklendi" durumunu dogrudan `graph.addNode(...)` ile
  // olusturuyoruz - 'node:added' event'i hangi yoldan tetiklenirse tetiklensin
  // (Dnd birakma ya da dogrudan ekleme) ayni calisiyor, bu yuzden test acisindan
  // esdeger. `graph` ve `functoidNodeConfig` private oldugu icin `as any` ile
  // erisiliyor - mevcut testler zaten `getSnapshot()` gibi ic yapiyi kontrol ediyor,
  // benzer bir ic erisim.
  function dropFunctoidAt(code: string, centerX: number, centerY: number): void {
    const internals = component as unknown as { graph: any; functoidNodeConfig: (...args: any[]) => any };
    const config = internals.functoidNodeConfig('dropped-1', code, 0, 0, null);
    const width = config.width as number;
    const height = config.height as number;
    internals.graph.addNode({ ...config, x: centerX - width / 2, y: centerY - height / 2 });
  }

  it('dropping a single-input functoid near a direct suggestion auto-connects it', () => {
    component.addSourceSchema(sourceSchema, 20, 20);
    component.showSuggestions([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);
    const line = component.suggestions()[0].lines[0];

    dropFunctoidAt('Trim', (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2);

    expect(component.suggestions().length).toBe(0);
    const snapshot = component.getSnapshot();
    expect(snapshot.functoidNodes.length).toBe(1);
    expect(snapshot.edges.length).toBe(2);
    const described = component.describeEdges();
    expect(described).toContainEqual({ id: expect.any(String), from: 'Ad', to: 'Trim.value' });
    expect(described).toContainEqual({ id: expect.any(String), from: 'Trim', to: 'AdSoyad' });
  });

  it('dropping a functoid far from any suggestion does not auto-connect', () => {
    component.addSourceSchema(sourceSchema, 20, 20);
    component.showSuggestions([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);

    dropFunctoidAt('Trim', 900, 900);

    expect(component.suggestions().length).toBe(1);
    expect(component.getSnapshot().edges.length).toBe(0);
  });

  it('dropping a two-input functoid near a direct suggestion does not auto-connect (out of scope)', () => {
    component.addSourceSchema(sourceSchema, 20, 20);
    component.showSuggestions([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);
    const line = component.suggestions()[0].lines[0];

    dropFunctoidAt('Concat', (line.x1 + line.x2) / 2, (line.y1 + line.y2) / 2);

    expect(component.suggestions().length).toBe(1);
    expect(component.getSnapshot().edges.length).toBe(0);
  });
});
