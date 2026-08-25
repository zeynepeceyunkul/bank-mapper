import { Component, EventEmitter, Input, Output } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';

import { MappingEditor } from './mapping-editor';
import { MappingCanvas, MappingCanvasSnapshot, SuggestedFieldMatch } from '../mapping-canvas/mapping-canvas';
import { FileType } from '../../../core/models/file-type.model';
import { SourceSchema } from '../../../core/models/source-schema.model';
import { ToastService } from '../../../core/services/toast.service';

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
  targetFields: [{ name: 'AdSoyad', type: 'string', order: 1, length: 50, isRequired: false }],
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
  @Input() viewOnly = false;
  @Output() readonly graphChanged = new EventEmitter<void>();

  snapshot: MappingCanvasSnapshot = emptySnapshot();
  lastSuggestions: SuggestedFieldMatch[] | null = null;

  getSnapshot(): MappingCanvasSnapshot {
    return this.snapshot;
  }

  showSuggestions(matches: SuggestedFieldMatch[]): void {
    this.lastSuggestions = matches;
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
      sourceSchemas: [...this.snapshot.sourceSchemas, { sourceSchemaId: schema.id, positionX: x, positionY: y }],
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

// saveMapping() ilk kayittan sonra /mapping/edit/:id'ye yonlendiriyor; bu
// route'un test router'inda eslesecek bir hedefi olmasi gerekiyor, yoksa
// Router.navigate "Cannot match any routes" ile reddediyor.
@Component({ selector: 'app-stub', template: '' })
class StubRouteTarget {}

describe('MappingEditor', () => {
  let component: MappingEditor;
  let fixture: ComponentFixture<MappingEditor>;
  let httpMock: HttpTestingController;
  let toastService: ToastService;

  function fakeCanvas(): FakeMappingCanvas {
    return fixture.debugElement.query(By.directive(FakeMappingCanvas)).componentInstance as FakeMappingCanvas;
  }

  beforeEach(async () => {
    // Bu suite'teki testler Kaydet/Onayla/AI oner/Sil gibi duzenleme
    // aksiyonlarini dogrudan cagiriyor - bu aksiyonlar artik
    // requireEditPermission() ile yetki kontrolu yapiyor (bkz.
    // mapping-editor.ts), o yuzden AuthService'in okudugu localStorage'a
    // duzenleme yapabilen bir rol yaziyoruz. Rol/yetki testleri role.guard
    // ve auth.service seviyesinde ayrica var, burasi sadece bu suite'in
    // zaten varsaydigi "duzenleyebilen kullanici" durumunu kuruyor.
    localStorage.setItem('bankmapper_role', 'SuperAdmin');

    await TestBed.configureTestingModule({
      imports: [MappingEditor],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'mapping', component: StubRouteTarget },
          { path: 'mapping/edit/:id', component: StubRouteTarget },
        ]),
      ],
    })
      .overrideComponent(MappingEditor, {
        remove: { imports: [MappingCanvas] },
        add: { imports: [FakeMappingCanvas] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MappingEditor);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    toastService = TestBed.inject(ToastService);

    fixture.detectChanges();

    httpMock.expectOne((req) => req.url.endsWith('/products')).flush([]);
    httpMock.expectOne((req) => req.url.endsWith('/source-schemas')).flush([sampleSourceSchema]);
    httpMock.expectOne((req) => req.url.endsWith('/functoids')).flush([]);
    httpMock.expectOne((req) => req.url.endsWith('/institutions')).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('bankmapper_role');
  });

  function selectTarget(): void {
    component.sourceSchemas.set([sampleSourceSchema]);
    component.fileTypes.set([sampleFileType]);
    component.selectedFileTypeId = sampleFileType.id;
    component.confirmHedef();
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('gates the canvas behind a selected and confirmed file type', () => {
    expect(fixture.debugElement.query(By.directive(FakeMappingCanvas))).toBeNull();

    component.sourceSchemas.set([sampleSourceSchema]);
    component.fileTypes.set([sampleFileType]);
    component.selectedFileTypeId = sampleFileType.id;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(FakeMappingCanvas))).toBeNull();

    component.confirmHedef();
    fixture.detectChanges();
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

  it('delegates remove-edge to the canvas', () => {
    selectTarget();
    // Sabit değer ekleme artık mapping-editor'de değil, doğrudan
    // MappingCanvas'ın kendi functoid paletinde (bkz. mapping-canvas.spec.ts).
    fakeCanvas().addConstant(260, 240);
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

    expect(toastService.all().map((t) => t.message)).toContain('En az bir hedef alan bağlantısı olmalı.');
    httpMock.expectNone((req) => req.url.endsWith('/mappings'));
  });

  it('sends the graph snapshot from the canvas when saving', () => {
    selectTarget();
    fakeCanvas().snapshot = {
      sourceSchemas: [{ sourceSchemaId: 'src-1', positionX: 20, positionY: 20 }],
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
      { sourceSchemaId: 'src-1', alias: 'Test Source', positionX: 20, positionY: 20 },
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

  it('rejects saving when more than one source schema is present', () => {
    selectTarget();
    fakeCanvas().snapshot = {
      sourceSchemas: [
        { sourceSchemaId: 'src-1', positionX: 20, positionY: 20 },
        { sourceSchemaId: 'src-2', positionX: 50, positionY: 50 },
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

    expect(toastService.all().map((t) => t.message)).toContain('Tam olarak bir kaynak şema seçilmelidir.');
    httpMock.expectNone((req) => req.url.endsWith('/mappings'));
  });

  it('disables (but keeps visible) the add-source-schema controls once one source schema is present', () => {
    selectTarget();
    component.newSourceSchemaId = sampleSourceSchema.id;
    component.addSourceSchema();
    fixture.detectChanges();

    const select = fixture.debugElement.query(By.css('#sourceSchema'));
    const addButton = fixture.debugElement.query(By.css('.add-source-schema .pill-btn'));
    expect(select).not.toBeNull();
    expect(addButton).not.toBeNull();
    expect(select.nativeElement.disabled).toBe(true);
    expect(addButton.nativeElement.disabled).toBe(true);

    // Guard'i UI devre-disi birakmasindan bagimsiz da dogruluyoruz: bir sema
    // secili olsa bile (elle) ikinci addSourceSchema() cagrisi hicbir sey eklemiyor.
    component.newSourceSchemaId = sampleSourceSchema.id;
    component.addSourceSchema();
    expect(fakeCanvas().getSourceSchemaIds()).toEqual(['src-1']);
  });

  // Bu testler AI eslestirme cagrisini test ediyor - HttpTestingController
  // sayesinde gercek bir aga (Gemini'ye) hic gidilmiyor, tamamen sahte veriyle.
  it('sends source and target field names and forwards the result to the canvas', () => {
    selectTarget();
    component.newSourceSchemaId = sampleSourceSchema.id;
    component.addSourceSchema();

    component.suggestMatches();

    const request = httpMock.expectOne((req) => req.url.endsWith('/field-match-suggestions'));
    expect(request.request.body).toEqual({
      sourceFieldNames: ['Ad', 'Soyad'],
      targetFields: [{ name: 'AdSoyad', length: 50 }],
    });
    expect(component.suggestingMatches()).toBe(true);

    request.flush([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);

    expect(component.suggestingMatches()).toBe(false);
    expect(fakeCanvas().lastSuggestions).toEqual([{ sourceFields: ['Ad'], targetField: 'AdSoyad', functoidCode: null }]);
  });

  it('shows an error when the suggestion request fails', () => {
    selectTarget();
    component.newSourceSchemaId = sampleSourceSchema.id;
    component.addSourceSchema();

    component.suggestMatches();

    const request = httpMock.expectOne((req) => req.url.endsWith('/field-match-suggestions'));
    request.flush('bozuldu', { status: 500, statusText: 'Server Error' });

    expect(component.suggestingMatches()).toBe(false);
    expect(component.suggestError()).toBe('Eşleştirme önerisi alınamadı. API çalışıyor mu?');
    expect(fakeCanvas().lastSuggestions).toBeNull();
  });

  it('onMappingDeleted resets to new-mapping mode AND navigates the URL back to /mapping when the deleted mapping is the one currently open', async () => {
    // Regresyon: Ece bunu canli yakaladi - onceki halinde sadece ic state
    // sifirlaniyordu, adres cubugu hala /mapping/edit/{silinenId}'de kaliyordu
    // (sayfa "Yeni Mapping Olustur" gostermesine ragmen). Sonra sayfa
    // yenilenince URL hala gecersiz id'yi tasidigi icin ayni 404 akisi tekrar
    // tetikleniyordu.
    const router = TestBed.inject(Router);
    component.mappingId = 'm-currently-open';
    component.mappingName = 'Acik Olan Mapping';

    component.onMappingDeleted('m-currently-open');
    await fixture.whenStable();

    expect(component.isEditMode).toBe(false);
    expect(component.mappingName).toBe('');
    expect(toastService.all().map((t) => t.message)).toContain('Düzenlemekte olduğunuz mapping silindi.');
    expect(router.url).toBe('/mapping');
  });

  it('onMappingDeleted does nothing when the deleted mapping is a different one', () => {
    component.mappingId = 'm-currently-open';
    component.mappingName = 'Acik Olan Mapping';

    component.onMappingDeleted('m-some-other-mapping');

    expect(component.mappingId).toBe('m-currently-open');
    expect(component.mappingName).toBe('Acik Olan Mapping');
  });

  it('saving an update to a mapping thats been deleted elsewhere (404) shows a clear message and resets to new-mapping mode', () => {
    selectTarget();
    component.mappingId = 'm-deleted';
    fakeCanvas().snapshot = {
      sourceSchemas: [{ sourceSchemaId: 'src-1', positionX: 20, positionY: 20 }],
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
    component.mappingName = 'Silinmis Mapping';

    component.saveMapping();

    const request = httpMock.expectOne((req) => req.url.endsWith('/mappings/m-deleted'));
    expect(request.request.method).toBe('PUT');
    request.flush(null, { status: 404, statusText: 'Not Found' });

    expect(component.isEditMode).toBe(false);
    expect(component.mappingName).toBe('');
    expect(toastService.all().map((t) => t.message)).toContain('Bu mapping artık mevcut değil (başka bir yerden silinmiş olabilir).');
  });

  it('loading a deleted mapping (404) shows a clear message and resets to new-mapping mode instead of leaving a stale half-loaded page', () => {
    // Regresyon: Ece bunu canli buldu - bir mapping'i "Kayitli Mapping'ler"
    // panelinden silip aynı mapping'in edit sayfasini yenileyince, eskiden
    // yanlis yonlendirici bir "API calisiyor mu?" mesaji goruluyordu ve sayfa
    // basligi hala "Mapping Duzenle" yaziyordu, hicbir sey yuklenmemis olsa bile.
    const internals = component as unknown as { loadExistingMapping: (id: string) => void };
    internals.loadExistingMapping('deleted-id');

    const request = httpMock.expectOne((req) => req.url.endsWith('/mappings/deleted-id'));
    request.flush('Not Found', { status: 404, statusText: 'Not Found' });

    expect(component.error()).toBe('Bu mapping artık mevcut değil (silinmiş olabilir).');
    expect(component.isEditMode).toBe(false);
    expect(component.mappingName).toBe('');
    expect(component.loadingExisting()).toBe(false);
  });
});
