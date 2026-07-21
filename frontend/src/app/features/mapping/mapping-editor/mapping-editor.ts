import { Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { SourceSchemaService } from '../../../core/services/source-schema.service';
import { MappingService } from '../../../core/services/mapping.service';
import { FunctoidService } from '../../../core/services/functoid.service';
import { FileType } from '../../../core/models/file-type.model';
import { Mapping } from '../../../core/models/mapping.model';
import { FunctoidDefinition } from '../../../core/models/functoid.model';
import { Product } from '../../../core/models/product.model';
import { SourceSchema } from '../../../core/models/source-schema.model';
import { MappingCanvas, MappingCanvasSnapshot } from '../mapping-canvas/mapping-canvas';
import { MappingList } from '../mapping-list/mapping-list';
import { SourceSchemaList } from '../../source-schemas/source-schema-list/source-schema-list';

@Component({
  selector: 'app-mapping-editor',
  imports: [FormsModule, RouterLink, MappingCanvas, MappingList, SourceSchemaList],
  templateUrl: './mapping-editor.html',
  styleUrl: './mapping-editor.scss',
})
export class MappingEditor implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly sourceSchemaService = inject(SourceSchemaService);
  private readonly mappingService = inject(MappingService);
  private readonly functoidService = inject(FunctoidService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  mappingId: string | null = null;
  readonly loadingExisting = signal(false);

  readonly showMappingsPanel = signal(false);
  readonly showSourceSchemaModal = signal(false);

  @ViewChild('canvas') canvas!: MappingCanvas;

  readonly products = signal<Product[]>([]);
  readonly fileTypes = signal<FileType[]>([]);
  readonly sourceSchemas = signal<SourceSchema[]>([]);
  readonly functoidDefinitions = signal<FunctoidDefinition[]>([]);
  readonly error = signal<string | null>(null);

  readonly sourceSchemasLoaded = signal(false);
  readonly functoidDefinitionsLoaded = signal(false);
  private readonly rawPendingSnapshot = signal<MappingCanvasSnapshot | null>(null);
  readonly effectiveSnapshot = computed(() =>
    this.sourceSchemasLoaded() && this.functoidDefinitionsLoaded() ? this.rawPendingSnapshot() : null
  );

  readonly usedSourceSchemaIds = signal<string[]>([]);
  readonly connections = signal<{ id: string; from: string; to: string }[]>([]);

  selectedProductId = '';
  selectedFileTypeId = '';
  newSourceSchemaId = '';

  mappingName = '';
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly savedMapping = signal<Mapping | null>(null);

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.error.set('Ürünler yüklenemedi. API çalışıyor mu?'),
    });

    this.sourceSchemaService.getAll().subscribe({
      next: (schemas) => {
        this.sourceSchemas.set(schemas);
        this.sourceSchemasLoaded.set(true);
      },
      error: () => this.error.set('Source şemalar yüklenemedi. API çalışıyor mu?'),
    });

    this.functoidService.getAll().subscribe({
      next: (definitions) => {
        this.functoidDefinitions.set(definitions);
        this.functoidDefinitionsLoaded.set(true);
      },
      error: () => this.error.set('Functoid listesi yüklenemedi. API çalışıyor mu?'),
    });

    // route.paramMap'e subscribe ediyoruz (snapshot değil): /mapping ve
    // /mapping/edit/:id aynı component instance'ını Angular router tarafından
    // yeniden kullanılıyor, tek seferlik snapshot okuma sayfa içi geçişlerde
    // (ör. "Kayıtlı Mapping'ler" panelinden başka bir mapping seçmek) state'i
    // güncellemez.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.mappingId = id;
        this.loadExistingMapping(id);
      } else {
        this.resetForNewMapping();
      }
    });
  }

  private resetForNewMapping(): void {
    this.mappingId = null;
    this.mappingName = '';
    this.selectedProductId = '';
    this.selectedFileTypeId = '';
    this.fileTypes.set([]);
    this.rawPendingSnapshot.set(null);
    this.savedMapping.set(null);
    this.saveError.set(null);
    this.error.set(null);
    this.resetGraphState();
  }

  private loadExistingMapping(id: string): void {
    this.loadingExisting.set(true);

    this.mappingService.getById(id).subscribe({
      next: (mapping) => {
        this.mappingName = mapping.name;
        this.rawPendingSnapshot.set({
          sourceSchemas: mapping.sourceSchemas.map((s) => ({
            sourceSchemaId: s.sourceSchemaId,
            joinKeyField: s.joinKeyField ?? null,
            positionX: s.positionX,
            positionY: s.positionY,
          })),
          functoidNodes: mapping.functoidNodes,
          constantNodes: mapping.constantNodes,
          edges: mapping.edges,
        });

        this.productService.getFileTypeById(mapping.fileTypeId).subscribe({
          next: (fileType) => {
            this.selectedProductId = fileType.productId;

            this.productService.getFileTypesByProductId(fileType.productId).subscribe({
              next: (fileTypes) => {
                this.fileTypes.set(fileTypes);
                this.selectedFileTypeId = mapping.fileTypeId;
                this.loadingExisting.set(false);
              },
              error: () => {
                this.error.set('Dosya tipleri yüklenemedi. API çalışıyor mu?');
                this.loadingExisting.set(false);
              },
            });
          },
          error: () => {
            this.error.set('Dosya tipi bilgisi yüklenemedi. API çalışıyor mu?');
            this.loadingExisting.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Mapping yüklenemedi. API çalışıyor mu?');
        this.loadingExisting.set(false);
      },
    });
  }

  onProductChange(): void {
    this.selectedFileTypeId = '';
    this.fileTypes.set([]);
    this.resetGraphState();

    if (!this.selectedProductId) {
      return;
    }

    this.productService.getFileTypesByProductId(this.selectedProductId).subscribe({
      next: (fileTypes) => this.fileTypes.set(fileTypes),
      error: () => this.error.set('Dosya tipleri yüklenemedi. API çalışıyor mu?'),
    });
  }

  onFileTypeChange(): void {
    this.resetGraphState();
  }

  private resetGraphState(): void {
    this.usedSourceSchemaIds.set([]);
    this.connections.set([]);
  }

  get selectedFileType(): FileType | undefined {
    return this.fileTypes().find((ft) => ft.id === this.selectedFileTypeId);
  }

  get isEditMode(): boolean {
    return !!this.mappingId;
  }

  get availableSourceSchemasToAdd(): SourceSchema[] {
    const used = new Set(this.usedSourceSchemaIds());
    return this.sourceSchemas().filter((s) => !used.has(s.id));
  }

  private defaultSchemaX(index: number): number {
    return 20 + index * 30;
  }

  private defaultSchemaY(index: number): number {
    return 20 + index * 30;
  }

  onGraphChanged(): void {
    this.usedSourceSchemaIds.set(this.canvas.getSourceSchemaIds());
    this.connections.set(this.canvas.describeEdges());
  }

  toggleMappingsPanel(): void {
    this.showMappingsPanel.update((v) => !v);
  }

  toggleSourceSchemaModal(): void {
    this.showSourceSchemaModal.update((v) => !v);
  }

  onSchemaCreated(schema: SourceSchema): void {
    this.sourceSchemas.update((list) => [...list, schema]);
  }

  addSourceSchema(): void {
    if (!this.newSourceSchemaId) {
      return;
    }
    const schema = this.sourceSchemas().find((s) => s.id === this.newSourceSchemaId);
    if (!schema) {
      return;
    }
    const index = this.usedSourceSchemaIds().length;
    this.canvas.addSourceSchema(schema, this.defaultSchemaX(index), this.defaultSchemaY(index));
    this.newSourceSchemaId = '';
  }

  addConstant(): void {
    this.canvas.addConstant(260, 240);
  }

  removeEdge(id: string): void {
    this.canvas.removeEdge(id);
  }

  saveMapping(): void {
    this.saveError.set(null);
    this.savedMapping.set(null);

    if (!this.mappingName.trim()) {
      this.saveError.set('Mapping adı zorunlu.');
      return;
    }

    const snapshot = this.canvas.getSnapshot();

    if (!snapshot.edges.some((e) => e.toKind === 'TargetField')) {
      this.saveError.set('En az bir hedef alan bağlantısı olmalı.');
      return;
    }

    if (snapshot.sourceSchemas.length > 1 && snapshot.sourceSchemas.some((s) => !s.joinKeyField)) {
      this.saveError.set('Birden fazla kaynak şema kullanılıyorsa her biri için birleştirme anahtarı seçilmelidir.');
      return;
    }

    this.saving.set(true);

    const request = {
      name: this.mappingName.trim(),
      sourceSchemas: snapshot.sourceSchemas.map((s) => ({
        sourceSchemaId: s.sourceSchemaId,
        alias: this.sourceSchemas().find((x) => x.id === s.sourceSchemaId)?.name ?? '',
        joinKeyField: s.joinKeyField,
        positionX: s.positionX,
        positionY: s.positionY,
      })),
      fileTypeId: this.selectedFileTypeId,
      functoidNodes: snapshot.functoidNodes,
      constantNodes: snapshot.constantNodes,
      edges: snapshot.edges,
    };

    const save$ = this.mappingId
      ? this.mappingService.update(this.mappingId, request)
      : this.mappingService.create(request);

    save$.subscribe({
      next: (mapping) => {
        this.savedMapping.set(mapping);
        this.saving.set(false);
      },
      error: () => {
        this.saveError.set('Mapping kaydedilemedi. API çalışıyor mu?');
        this.saving.set(false);
      },
    });
  }

  targetFieldEdgeCount(mapping: Mapping): number {
    return mapping.edges.filter((e) => e.toKind === 'TargetField').length;
  }
}
