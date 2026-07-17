import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { SourceSchemaService } from '../../../core/services/source-schema.service';
import { MappingService } from '../../../core/services/mapping.service';
import { FunctoidService } from '../../../core/services/functoid.service';
import { FileType, TargetField } from '../../../core/models/file-type.model';
import { ConstantNode, EdgeEndpointKind, FunctoidNode, GraphEdge, Mapping } from '../../../core/models/mapping.model';
import { FunctoidDefinition, FunctoidParameterDefinition, FunctoidPortDefinition } from '../../../core/models/functoid.model';
import { Product } from '../../../core/models/product.model';
import { SourceField, SourceSchema } from '../../../core/models/source-schema.model';
import { FunctoidPicker } from '../functoid-picker/functoid-picker';

interface OutputPortRef {
  kind: 'SourceField' | 'NodeOutput' | 'ConstantOutput';
  fieldName?: string;
  sourceSchemaId?: string;
  nodeId?: string;
}

interface InputPortRef {
  kind: 'NodeInput' | 'TargetField';
  nodeId?: string;
  port?: string;
  fieldName?: string;
}

interface FunctoidNodeView {
  node: FunctoidNode;
  definition: FunctoidDefinition | undefined;
  ports: FunctoidPortDefinition[];
  height: number;
}

interface LineSegment {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function randomId(): string {
  return crypto.randomUUID();
}

@Component({
  selector: 'app-mapping-editor',
  imports: [FormsModule, FunctoidPicker],
  templateUrl: './mapping-editor.html',
  styleUrl: './mapping-editor.scss',
})
export class MappingEditor implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly sourceSchemaService = inject(SourceSchemaService);
  private readonly mappingService = inject(MappingService);
  private readonly functoidService = inject(FunctoidService);
  private readonly route = inject(ActivatedRoute);

  mappingId: string | null = null;
  readonly loadingExisting = signal(false);

  @ViewChild('canvasEl') canvasElRef!: ElementRef<HTMLDivElement>;

  readonly products = signal<Product[]>([]);
  readonly fileTypes = signal<FileType[]>([]);
  readonly sourceSchemas = signal<SourceSchema[]>([]);
  readonly error = signal<string | null>(null);

  selectedProductId = '';
  selectedFileTypeId = '';
  selectedSourceSchemaId = '';

  readonly functoidNodes = signal<FunctoidNode[]>([]);
  readonly constantNodes = signal<ConstantNode[]>([]);
  readonly edges = signal<GraphEdge[]>([]);

  readonly functoidDefinitions = signal<FunctoidDefinition[]>([]);
  activeParamNodeId: string | null = null;

  dragFromPort: OutputPortRef | null = null;
  dragPointer: { x: number; y: number } | null = null;

  dragNode: { type: 'functoid' | 'constant'; id: string } | null = null;
  private dragNodeOffset = { dx: 0, dy: 0 };
  private dragNodeStart = { x: 0, y: 0 };
  private dragNodeMoved = false;

  mappingName = '';
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly savedMapping = signal<Mapping | null>(null);

  readonly rowHeight = 44;
  readonly rowTop = 12;
  readonly canvasWidth = 960;
  readonly columnWidth = 220;
  readonly nodeWidth = 140;
  readonly nodeHeight = 36;
  readonly constantNodeHeight = 36;

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

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mappingId = id;
      this.loadExistingMapping(id);
    }
  }

  private loadExistingMapping(id: string): void {
    this.loadingExisting.set(true);

    this.mappingService.getById(id).subscribe({
      next: (mapping) => {
        this.mappingName = mapping.name;
        this.selectedSourceSchemaId = mapping.sourceSchemas[0]?.sourceSchemaId ?? '';
        this.functoidNodes.set(mapping.functoidNodes);
        this.constantNodes.set(mapping.constantNodes);
        this.edges.set(mapping.edges);

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
    this.resetGraph();

    if (!this.selectedProductId) {
      return;
    }

    this.productService.getFileTypesByProductId(this.selectedProductId).subscribe({
      next: (fileTypes) => this.fileTypes.set(fileTypes),
      error: () => this.error.set('Dosya tipleri yüklenemedi. API çalışıyor mu?'),
    });
  }

  onFileTypeChange(): void {
    this.resetGraph();
  }

  onSourceSchemaChange(): void {
    this.resetGraph();
  }

  private resetGraph(): void {
    this.functoidNodes.set([]);
    this.constantNodes.set([]);
    this.edges.set([]);
    this.activeParamNodeId = null;
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

  get isEditMode(): boolean {
    return !!this.mappingId;
  }

  get sourceFieldsList(): SourceField[] {
    return [...(this.selectedSourceSchema?.fields ?? [])].sort((a, b) => a.order - b.order);
  }

  get targetFieldsList(): TargetField[] {
    return [...(this.selectedFileType?.targetFields ?? [])].sort((a, b) => a.order - b.order);
  }

  get functoidNodeViews(): FunctoidNodeView[] {
    return this.functoidNodes().map((node) => {
      const definition = this.functoidDefinitions().find((d) => d.code === node.functoidCode);
      const ports = definition?.inputPorts?.length ? definition.inputPorts : [{ name: 'value', label: 'Değer' }];
      return { node, definition, ports, height: this.nodeHeightFor(ports.length) };
    });
  }

  get canvasHeight(): number {
    const rows = Math.max(this.sourceFieldsList.length, this.targetFieldsList.length, 1);
    const fieldsHeight = rows * this.rowHeight + this.rowTop * 2;

    const nodeBottoms = [
      ...this.functoidNodeViews.map((v) => v.node.positionY + v.height),
      ...this.constantNodes().map((c) => c.positionY + this.constantNodeHeight),
    ];
    const maxNodeBottom = nodeBottoms.length > 0 ? Math.max(...nodeBottoms) : 0;

    return Math.max(fieldsHeight, maxNodeBottom + 60);
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

  nodeHeightFor(portCount: number): number {
    return portCount <= 1 ? this.nodeHeight : portCount * 30;
  }

  portOffsetY(index: number, portCount: number, height: number): number {
    return ((index + 0.5) * height) / portCount;
  }

  // --- Sürükleme: mevcut node'u taşıma (tıklama ile parametre panelini ayırt eder) ---

  onNodeBodyMouseDown(type: 'functoid' | 'constant', id: string, currentX: number, currentY: number, event: MouseEvent): void {
    event.preventDefault();
    const pointer = this.pointerPosition(event);
    this.dragNode = { type, id };
    this.dragNodeOffset = { dx: pointer.x - currentX, dy: pointer.y - currentY };
    this.dragNodeStart = pointer;
    this.dragNodeMoved = false;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.dragFromPort) {
      this.dragPointer = this.pointerPosition(event);
    }

    if (this.dragNode) {
      const pointer = this.pointerPosition(event);
      if (Math.abs(pointer.x - this.dragNodeStart.x) > 4 || Math.abs(pointer.y - this.dragNodeStart.y) > 4) {
        this.dragNodeMoved = true;
      }
      this.updateNodePosition(this.dragNode.type, this.dragNode.id, pointer.x - this.dragNodeOffset.dx, pointer.y - this.dragNodeOffset.dy);
    }
  }

  onCanvasMouseUp(): void {
    if (this.dragNode && !this.dragNodeMoved && this.dragNode.type === 'functoid') {
      this.activeParamNodeId = this.activeParamNodeId === this.dragNode.id ? null : this.dragNode.id;
    }

    this.dragFromPort = null;
    this.dragPointer = null;
    this.dragNode = null;
  }

  private updateNodePosition(type: 'functoid' | 'constant', id: string, x: number, y: number): void {
    if (type === 'functoid') {
      this.functoidNodes.update((list) => list.map((n) => (n.id === id ? { ...n, positionX: x, positionY: y } : n)));
    } else {
      this.constantNodes.update((list) => list.map((n) => (n.id === id ? { ...n, positionX: x, positionY: y } : n)));
    }
  }

  // --- Bağlantı (edge) kurma: port'tan port'a sürükleme ---

  onSourceDotMouseDown(fieldName: string, event: MouseEvent): void {
    event.preventDefault();
    this.dragFromPort = { kind: 'SourceField', fieldName, sourceSchemaId: this.selectedSourceSchemaId };
    this.dragPointer = this.pointerPosition(event);
  }

  onNodeOutputMouseDown(nodeId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragFromPort = { kind: 'NodeOutput', nodeId };
    this.dragPointer = this.pointerPosition(event);
  }

  onConstantOutputMouseDown(nodeId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragFromPort = { kind: 'ConstantOutput', nodeId };
    this.dragPointer = this.pointerPosition(event);
  }

  onTargetDotMouseUp(fieldName: string, event: MouseEvent): void {
    event.stopPropagation();
    this.finishWiring({ kind: 'TargetField', fieldName });
  }

  onNodeInputMouseUp(nodeId: string, port: string, event: MouseEvent): void {
    event.stopPropagation();
    this.finishWiring({ kind: 'NodeInput', nodeId, port });
  }

  private finishWiring(to: InputPortRef): void {
    if (this.dragFromPort) {
      this.wireEdge(this.dragFromPort, to);
    }
    this.dragFromPort = null;
    this.dragPointer = null;
  }

  private wireEdge(from: OutputPortRef, to: InputPortRef): void {
    const newEdge: GraphEdge = {
      id: randomId(),
      fromKind: from.kind as EdgeEndpointKind,
      fromSourceSchemaId: from.kind === 'SourceField' ? (from.sourceSchemaId ?? null) : null,
      fromFieldName: from.kind === 'SourceField' ? (from.fieldName ?? null) : null,
      fromNodeId: from.kind !== 'SourceField' ? (from.nodeId ?? null) : null,
      toKind: to.kind as EdgeEndpointKind,
      toNodeId: to.kind === 'NodeInput' ? (to.nodeId ?? null) : null,
      toPort: to.kind === 'NodeInput' ? (to.port ?? null) : null,
      toFieldName: to.kind === 'TargetField' ? (to.fieldName ?? null) : null,
    };

    this.edges.update((list) => [...list.filter((e) => !this.sameInput(e, to)), newEdge]);
  }

  private sameInput(edge: GraphEdge, to: InputPortRef): boolean {
    if (to.kind === 'NodeInput') {
      return edge.toKind === 'NodeInput' && edge.toNodeId === to.nodeId && edge.toPort === to.port;
    }
    return edge.toKind === 'TargetField' && edge.toFieldName === to.fieldName;
  }

  isDraggingFromSourceField(fieldName: string): boolean {
    return this.dragFromPort?.kind === 'SourceField' && this.dragFromPort.fieldName === fieldName;
  }

  isDraggingFromNode(nodeId: string): boolean {
    return (this.dragFromPort?.kind === 'NodeOutput' || this.dragFromPort?.kind === 'ConstantOutput') && this.dragFromPort.nodeId === nodeId;
  }

  removeEdge(id: string): void {
    this.edges.update((list) => list.filter((e) => e.id !== id));
  }

  describeFrom(edge: GraphEdge): string {
    if (edge.fromKind === 'SourceField') {
      return edge.fromFieldName ?? '?';
    }
    if (edge.fromKind === 'NodeOutput') {
      const node = this.functoidNodes().find((n) => n.id === edge.fromNodeId);
      return node ? node.functoidCode : '?';
    }
    const constant = this.constantNodes().find((c) => c.id === edge.fromNodeId);
    return constant ? `"${constant.value}"` : '?';
  }

  describeTo(edge: GraphEdge): string {
    if (edge.toKind === 'TargetField') {
      return edge.toFieldName ?? '?';
    }
    const node = this.functoidNodes().find((n) => n.id === edge.toNodeId);
    return node ? `${node.functoidCode}.${edge.toPort}` : '?';
  }

  // --- Palet ten sürükle-bırak ile functoid node oluşturma ---

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    const code = event.dataTransfer?.getData('text/functoid-code');
    if (!code) {
      return;
    }

    const pointer = this.pointerPosition(event);
    this.addFunctoidNode(code, pointer.x, pointer.y);
  }

  addFunctoidNode(functoidCode: string, x: number, y: number): void {
    this.functoidNodes.update((list) => [...list, { id: randomId(), functoidCode, params: null, positionX: x, positionY: y }]);
  }

  removeFunctoidNode(id: string): void {
    this.functoidNodes.update((list) => list.filter((n) => n.id !== id));
    this.edges.update((list) =>
      list.filter((e) => !(e.fromKind === 'NodeOutput' && e.fromNodeId === id) && !(e.toKind === 'NodeInput' && e.toNodeId === id))
    );
    if (this.activeParamNodeId === id) {
      this.activeParamNodeId = null;
    }
  }

  addConstant(): void {
    const offset = this.constantNodes().length * 24;
    this.constantNodes.update((list) => [
      ...list,
      { id: randomId(), value: '', positionX: this.sourceDotX + 40 + offset, positionY: 20 + offset },
    ]);
  }

  removeConstantNode(id: string): void {
    this.constantNodes.update((list) => list.filter((n) => n.id !== id));
    this.edges.update((list) => list.filter((e) => !(e.fromKind === 'ConstantOutput' && e.fromNodeId === id)));
  }

  setConstantValue(id: string, value: string): void {
    this.constantNodes.update((list) => list.map((n) => (n.id === id ? { ...n, value } : n)));
  }

  // --- Functoid parametre paneli ---

  get activeParamView(): FunctoidNodeView | undefined {
    return this.activeParamNodeId ? this.functoidNodeViews.find((v) => v.node.id === this.activeParamNodeId) : undefined;
  }

  paramValue(node: FunctoidNode, key: string): string {
    const raw = node.params?.[key];
    return raw === undefined || raw === null ? '' : String(raw);
  }

  setParamValue(node: FunctoidNode, param: FunctoidParameterDefinition, raw: string): void {
    this.functoidNodes.update((list) =>
      list.map((n) => {
        if (n.id !== node.id) {
          return n;
        }
        const value: unknown = param.type === 'number' ? Number(raw) : raw;
        return { ...n, params: { ...(n.params ?? {}), [param.key]: value } };
      })
    );
  }

  closeParamPanel(): void {
    this.activeParamNodeId = null;
  }

  // --- Bağlantı çizgileri ---

  get connectionSegments(): LineSegment[] {
    const segments: LineSegment[] = [];

    for (const edge of this.edges()) {
      const from = this.resolveOutputPoint(this.edgeFromRef(edge));
      const to = this.resolveInputPoint(this.edgeToRef(edge));
      if (from && to) {
        segments.push({ key: edge.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
      }
    }

    return segments;
  }

  private edgeFromRef(edge: GraphEdge): OutputPortRef {
    if (edge.fromKind === 'SourceField') {
      return { kind: 'SourceField', fieldName: edge.fromFieldName ?? undefined };
    }
    return { kind: edge.fromKind as 'NodeOutput' | 'ConstantOutput', nodeId: edge.fromNodeId ?? undefined };
  }

  private edgeToRef(edge: GraphEdge): InputPortRef {
    if (edge.toKind === 'TargetField') {
      return { kind: 'TargetField', fieldName: edge.toFieldName ?? undefined };
    }
    return { kind: 'NodeInput', nodeId: edge.toNodeId ?? undefined, port: edge.toPort ?? undefined };
  }

  private resolveOutputPoint(ref: OutputPortRef): { x: number; y: number } | null {
    if (ref.kind === 'SourceField') {
      const idx = this.sourceIndex(ref.fieldName ?? '');
      return idx < 0 ? null : { x: this.sourceDotX, y: this.rowCenterY(idx) };
    }

    if (ref.kind === 'NodeOutput') {
      const view = this.functoidNodeViews.find((v) => v.node.id === ref.nodeId);
      return view ? { x: view.node.positionX + this.nodeWidth, y: view.node.positionY + view.height / 2 } : null;
    }

    const constant = this.constantNodes().find((c) => c.id === ref.nodeId);
    return constant ? { x: constant.positionX + this.nodeWidth, y: constant.positionY + this.constantNodeHeight / 2 } : null;
  }

  private resolveInputPoint(ref: InputPortRef): { x: number; y: number } | null {
    if (ref.kind === 'TargetField') {
      const idx = this.targetIndex(ref.fieldName ?? '');
      return idx < 0 ? null : { x: this.targetDotX, y: this.rowCenterY(idx) };
    }

    const view = this.functoidNodeViews.find((v) => v.node.id === ref.nodeId);
    if (!view) {
      return null;
    }
    const portIndex = view.ports.findIndex((p) => p.name === ref.port);
    if (portIndex < 0) {
      return null;
    }
    return { x: view.node.positionX, y: view.node.positionY + this.portOffsetY(portIndex, view.ports.length, view.height) };
  }

  get dragPreviewLine(): { x1: number; y1: number; x2: number; y2: number } | null {
    if (!this.dragFromPort || !this.dragPointer) {
      return null;
    }
    const from = this.resolveOutputPoint(this.dragFromPort);
    return from ? { x1: from.x, y1: from.y, x2: this.dragPointer.x, y2: this.dragPointer.y } : null;
  }

  private pointerPosition(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.canvasElRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  saveMapping(): void {
    this.saveError.set(null);
    this.savedMapping.set(null);

    if (!this.mappingName.trim()) {
      this.saveError.set('Mapping adı zorunlu.');
      return;
    }

    if (!this.edges().some((e) => e.toKind === 'TargetField')) {
      this.saveError.set('En az bir hedef alan bağlantısı olmalı.');
      return;
    }

    this.saving.set(true);

    const request = {
      name: this.mappingName.trim(),
      sourceSchemas: [{ sourceSchemaId: this.selectedSourceSchemaId, alias: this.selectedSourceSchema?.name ?? '' }],
      fileTypeId: this.selectedFileTypeId,
      functoidNodes: this.functoidNodes(),
      constantNodes: this.constantNodes(),
      edges: this.edges(),
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
