import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { SourceSchemaService } from '../../../core/services/source-schema.service';
import { MappingService } from '../../../core/services/mapping.service';
import { FunctoidService } from '../../../core/services/functoid.service';
import { FileType, TargetField } from '../../../core/models/file-type.model';
import { FieldMapping, FunctoidStep, Mapping } from '../../../core/models/mapping.model';
import { FunctoidDefinition, FunctoidParameterDefinition } from '../../../core/models/functoid.model';
import { Product } from '../../../core/models/product.model';
import { SourceField, SourceSchema } from '../../../core/models/source-schema.model';

interface FieldConnection {
  sourceField: string;
  targetField: string;
}

@Component({
  selector: 'app-mapping-editor',
  imports: [FormsModule],
  templateUrl: './mapping-editor.html',
  styleUrl: './mapping-editor.scss',
})
export class MappingEditor implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly sourceSchemaService = inject(SourceSchemaService);
  private readonly mappingService = inject(MappingService);
  private readonly functoidService = inject(FunctoidService);

  @ViewChild('canvasEl') canvasElRef!: ElementRef<HTMLDivElement>;

  readonly products = signal<Product[]>([]);
  readonly fileTypes = signal<FileType[]>([]);
  readonly sourceSchemas = signal<SourceSchema[]>([]);
  readonly error = signal<string | null>(null);

  selectedProductId = '';
  selectedFileTypeId = '';
  selectedSourceSchemaId = '';

  readonly connections = signal<FieldConnection[]>([]);
  dragFromField: string | null = null;
  dragPointer: { x: number; y: number } | null = null;

  readonly functoidDefinitions = signal<FunctoidDefinition[]>([]);
  readonly targetFunctoids = signal<Record<string, FunctoidStep[]>>({});
  activeFunctoidTarget: string | null = null;
  functoidFormCode = '';
  functoidFormParams: Record<string, string> = {};

  mappingName = '';
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly savedMapping = signal<Mapping | null>(null);

  readonly rowHeight = 44;
  readonly rowTop = 12;
  readonly canvasWidth = 640;
  readonly columnWidth = 220;

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.error.set('Ürünler yüklenemedi. API çalışıyor mu?'),
    });

    this.sourceSchemaService.getAll().subscribe({
      next: (schemas) => this.sourceSchemas.set(schemas),
      error: () => this.error.set('Source şemalar yüklenemedi. API çalışıyor mu?'),
    });

    this.functoidService.getAll().subscribe({
      next: (definitions) => this.functoidDefinitions.set(definitions),
      error: () => this.error.set('Functoid listesi yüklenemedi. API çalışıyor mu?'),
    });
  }

  onProductChange(): void {
    this.selectedFileTypeId = '';
    this.fileTypes.set([]);
    this.connections.set([]);
    this.targetFunctoids.set({});

    if (!this.selectedProductId) {
      return;
    }

    this.productService.getFileTypesByProductId(this.selectedProductId).subscribe({
      next: (fileTypes) => this.fileTypes.set(fileTypes),
      error: () => this.error.set('Dosya tipleri yüklenemedi. API çalışıyor mu?'),
    });
  }

  onFileTypeChange(): void {
    this.connections.set([]);
    this.targetFunctoids.set({});
  }

  onSourceSchemaChange(): void {
    this.connections.set([]);
    this.targetFunctoids.set({});
  }

  get selectedFileType(): FileType | undefined {
    return this.fileTypes().find((ft) => ft.id === this.selectedFileTypeId);
  }

  get selectedSourceSchema(): SourceSchema | undefined {
    return this.sourceSchemas().find((s) => s.id === this.selectedSourceSchemaId);
  }

  get readyForCanvas(): boolean {
    return !!this.selectedFileType && !!this.selectedSourceSchema;
  }

  get sourceFieldsList(): SourceField[] {
    return [...(this.selectedSourceSchema?.fields ?? [])].sort((a, b) => a.order - b.order);
  }

  get targetFieldsList(): TargetField[] {
    return [...(this.selectedFileType?.targetFields ?? [])].sort((a, b) => a.order - b.order);
  }

  get canvasHeight(): number {
    const rows = Math.max(this.sourceFieldsList.length, this.targetFieldsList.length, 1);
    return rows * this.rowHeight + this.rowTop * 2;
  }

  get sourceDotX(): number {
    return this.columnWidth;
  }

  get targetDotX(): number {
    return this.canvasWidth - this.columnWidth;
  }

  rowCenterY(index: number): number {
    return this.rowTop + index * this.rowHeight + this.rowHeight / 2;
  }

  sourceIndex(fieldName: string): number {
    return this.sourceFieldsList.findIndex((f) => f.name === fieldName);
  }

  targetIndex(fieldName: string): number {
    return this.targetFieldsList.findIndex((f) => f.name === fieldName);
  }

  onSourceDotMouseDown(fieldName: string, event: MouseEvent): void {
    event.preventDefault();
    this.dragFromField = fieldName;
    this.updateDragPointer(event);
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.dragFromField) {
      this.updateDragPointer(event);
    }
  }

  onCanvasMouseUp(): void {
    this.dragFromField = null;
    this.dragPointer = null;
  }

  onTargetDotMouseUp(fieldName: string, event: MouseEvent): void {
    event.stopPropagation();

    if (this.dragFromField) {
      const from = this.dragFromField;
      const alreadyExists = this.connections().some(
        (c) => c.sourceField === from && c.targetField === fieldName
      );

      if (!alreadyExists) {
        this.connections.update((list) => [...list, { sourceField: from, targetField: fieldName }]);
      }
    }

    this.dragFromField = null;
    this.dragPointer = null;
  }

  removeConnection(index: number): void {
    const removed = this.connections()[index];
    this.connections.update((list) => list.filter((_, i) => i !== index));

    const stillMapped = this.connections().some((c) => c.targetField === removed.targetField);
    if (!stillMapped) {
      this.targetFunctoids.update((map) => {
        const { [removed.targetField]: _removedChain, ...rest } = map;
        return rest;
      });
    }
  }

  get mappedTargetFields(): TargetField[] {
    const targetNames = new Set(this.connections().map((c) => c.targetField));
    return this.targetFieldsList.filter((f) => targetNames.has(f.name));
  }

  functoidsFor(targetField: string): FunctoidStep[] {
    return this.targetFunctoids()[targetField] ?? [];
  }

  get selectedFunctoidParams(): FunctoidParameterDefinition[] {
    return this.functoidDefinitions().find((f) => f.code === this.functoidFormCode)?.parameters ?? [];
  }

  openFunctoidForm(targetField: string): void {
    this.activeFunctoidTarget = targetField;
    this.functoidFormCode = '';
    this.functoidFormParams = {};
  }

  closeFunctoidForm(): void {
    this.activeFunctoidTarget = null;
  }

  addFunctoid(targetField: string): void {
    if (!this.functoidFormCode) {
      return;
    }

    const definition = this.functoidDefinitions().find((f) => f.code === this.functoidFormCode);
    const params: Record<string, string | number> = {};

    for (const paramDef of definition?.parameters ?? []) {
      const raw = this.functoidFormParams[paramDef.key] ?? '';
      params[paramDef.key] = paramDef.type === 'number' ? Number(raw) : raw;
    }

    this.targetFunctoids.update((map) => {
      const existing = map[targetField] ?? [];
      const step: FunctoidStep = { type: this.functoidFormCode, order: existing.length + 1, params };
      return { ...map, [targetField]: [...existing, step] };
    });

    this.closeFunctoidForm();
  }

  removeFunctoid(targetField: string, index: number): void {
    this.targetFunctoids.update((map) => {
      const existing = map[targetField] ?? [];
      const updated = existing.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i + 1 }));
      return { ...map, [targetField]: updated };
    });
  }

  formatFunctoidParams(params?: Record<string, unknown> | null): string {
    if (!params) {
      return '';
    }
    const entries = Object.entries(params);
    return entries.length > 0 ? entries.map(([key, value]) => `${key}=${value}`).join(', ') : '';
  }

  private updateDragPointer(event: MouseEvent): void {
    const rect = this.canvasElRef.nativeElement.getBoundingClientRect();
    this.dragPointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  saveMapping(): void {
    this.saveError.set(null);
    this.savedMapping.set(null);

    if (!this.mappingName.trim()) {
      this.saveError.set('Mapping adı zorunlu.');
      return;
    }

    if (this.connections().length === 0) {
      this.saveError.set('En az bir bağlantı çizmelisin.');
      return;
    }

    this.saving.set(true);

    this.mappingService
      .create({
        name: this.mappingName.trim(),
        sourceSchemaId: this.selectedSourceSchemaId,
        fileTypeId: this.selectedFileTypeId,
        fieldMappings: this.buildFieldMappings(),
      })
      .subscribe({
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

  private buildFieldMappings(): FieldMapping[] {
    const sourceFieldsByTarget = new Map<string, string[]>();

    for (const conn of this.connections()) {
      const sourceFields = sourceFieldsByTarget.get(conn.targetField) ?? [];
      sourceFields.push(conn.sourceField);
      sourceFieldsByTarget.set(conn.targetField, sourceFields);
    }

    return Array.from(sourceFieldsByTarget.entries()).map(([targetField, sourceFields]) => ({
      targetField,
      sourceFields,
      functoidChain: this.functoidsFor(targetField),
    }));
  }
}
