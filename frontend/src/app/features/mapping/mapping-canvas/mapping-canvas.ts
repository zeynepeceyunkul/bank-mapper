import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Edge, Graph, Node } from '@antv/x6';
import { Dnd } from '@antv/x6-plugin-dnd';
import { Snapline } from '@antv/x6-plugin-snapline';
import { FileType } from '../../../core/models/file-type.model';
import { ConstantNode, EdgeEndpointKind, FunctoidNode, GraphEdge } from '../../../core/models/mapping.model';
import { FunctoidDefinition, FunctoidParameterDefinition } from '../../../core/models/functoid.model';
import { SourceSchema } from '../../../core/models/source-schema.model';

export interface SourceSchemaRefInput {
  sourceSchemaId: string;
  joinKeyField: string | null;
  positionX: number;
  positionY: number;
}

export interface MappingCanvasSnapshot {
  sourceSchemas: SourceSchemaRefInput[];
  functoidNodes: FunctoidNode[];
  constantNodes: ConstantNode[];
  edges: GraphEdge[];
}

interface ParamPanelState {
  nodeId: string;
  x: number;
  y: number;
  functoidCode: string;
  params: Record<string, unknown>;
}

interface ConstantEditState {
  nodeId: string;
  x: number;
  y: number;
  value: string;
}

interface JoinKeySelector {
  schemaId: string;
  x: number;
  y: number;
  value: string;
  fields: string[];
}

const TITLE_HEIGHT = 30;
const ROW_HEIGHT = 28;
const SCHEMA_BOX_WIDTH = 220;
const NODE_WIDTH = 140;
const NODE_HEIGHT = 36;
const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;
// X6'nin custom `textVerticalAnchor` attr'i, referans (`ref`) verilmezse
// metni kendi satırına gore degil TUM node'un bbox merkezine gore kaydiriyor
// (bkz. mapping_x6_canvas_migration bellek notu). Bunun yerine dogal SVG
// baseline'ina guveniyoruz ve gorsel dikey ortalama icin sabit bir offset
// ekliyoruz.
const TEXT_BASELINE_OFFSET = 4;

const TARGET_NODE_ID = 'tgt';
const srcId = (schemaId: string) => `src:${schemaId}`;
const fnId = (id: string) => `fn:${id}`;
const constId = (id: string) => `const:${id}`;

function randomId(): string {
  return crypto.randomUUID();
}

function schemaBoxHeight(fieldCount: number): number {
  return TITLE_HEIGHT + Math.max(fieldCount, 1) * ROW_HEIGHT + 6;
}

@Component({
  selector: 'app-mapping-canvas',
  imports: [FormsModule],
  templateUrl: './mapping-canvas.html',
  styleUrl: './mapping-canvas.scss',
})
export class MappingCanvas implements AfterViewInit, OnChanges, OnDestroy {
  @Input() functoidDefinitions: FunctoidDefinition[] = [];
  @Input() targetFileType: FileType | null = null;
  @Input() allSourceSchemas: SourceSchema[] = [];

  @Input()
  set initialSnapshot(snapshot: MappingCanvasSnapshot | null) {
    this.pendingSnapshot = snapshot;
    this.tryHydrate();
  }

  @Output() readonly graphChanged = new EventEmitter<void>();

  @ViewChild('canvasHost', { static: true }) canvasHostRef!: ElementRef<HTMLDivElement>;

  private graph!: Graph;
  private dnd!: Dnd;
  private pendingSnapshot: MappingCanvasSnapshot | null = null;
  private hydrated = false;
  private suppress = false;

  // Signal olarak tutuluyor: X6'nın kendi event bus'ı zone.js tarafından
  // sarmalanmıyor, düz property mutasyonları Angular change detection'ı
  // tetiklemiyordu (parametre paneli state'i doluyordu ama template hiç
  // güncellenmiyordu). Signal write'ları zone'dan bağımsız CD tetikler.
  readonly paramPanel = signal<ParamPanelState | null>(null);
  readonly constantEdit = signal<ConstantEditState | null>(null);
  readonly joinKeySelectors = signal<JoinKeySelector[]>([]);

  ngAfterViewInit(): void {
    this.suppress = true;
    this.graph = new Graph({
      container: this.canvasHostRef.nativeElement,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      panning: false,
      mousewheel: false,
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        snap: true,
        validateConnection: ({ sourceMagnet, targetMagnet, sourceCell, targetCell }) => {
          if (!sourceMagnet || !targetMagnet) return false;
          if (sourceCell === targetCell) return false;
          return sourceMagnet.getAttribute('port-group') === 'out' && targetMagnet.getAttribute('port-group') === 'in';
        },
        createEdge: () =>
          this.graph.createEdge({
            attrs: { line: { stroke: '#1a73e8', strokeWidth: 2, targetMarker: null } },
            zIndex: 0,
          }),
      },
    });

    this.graph.use(new Snapline({ enabled: true }));
    this.dnd = new Dnd({ target: this.graph });

    this.graph.on('edge:connected', ({ edge }) => {
      this.dedupeIncomingEdges(edge);
      this.emitGraphChanged();
    });
    this.graph.on('edge:removed', () => this.emitGraphChanged());
    this.graph.on('node:added', () => this.emitGraphChanged());
    this.graph.on('node:removed', ({ node }) => {
      this.graph.getConnectedEdges(node).forEach((e) => this.graph.removeEdge(e.id));
      this.refreshJoinKeySelectors();
      this.emitGraphChanged();
    });
    this.graph.on('node:change:position', () => {
      this.repositionOverlays();
      this.refreshJoinKeySelectors();
    });
    this.graph.on('node:click', ({ node }) => this.onNodeClick(node));
    this.graph.on('blank:click', () => {
      this.paramPanel.set(null);
      this.constantEdit.set(null);
    });

    this.rebuildTargetNode();
    this.tryHydrate();

    // İlk kurulumda eklenen hedef node/olası hydration, parent'ın @ViewChild
    // referansı henüz atanmadan senkron event fırlatmasın diye bildirim bir
    // sonraki microtask'a erteleniyor (tek seferlik emit burada yapılır).
    queueMicrotask(() => {
      this.suppress = false;
      this.emitGraphChanged();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetFileType'] && this.graph) {
      this.rebuildTargetNode();
      this.tryHydrate();
    }
  }

  ngOnDestroy(): void {
    this.graph?.dispose();
  }

  private tryHydrate(): void {
    if (this.hydrated || !this.graph || !this.pendingSnapshot || !this.targetFileType) {
      return;
    }
    this.hydrated = true;
    this.loadSnapshot(this.pendingSnapshot);
  }

  private emitGraphChanged(): void {
    if (!this.suppress) {
      this.graphChanged.emit();
    }
  }

  // --- Hedef kutusu ---

  private rebuildTargetNode(): void {
    const existing = this.graph.getCellById(TARGET_NODE_ID);
    if (existing) {
      this.graph.removeCell(existing);
    }
    if (!this.targetFileType) {
      return;
    }
    const x = CANVAS_WIDTH - SCHEMA_BOX_WIDTH - 60;
    this.graph.addNode(this.targetNodeConfig(this.targetFileType, x, 20));
  }

  // --- Node config üreticileri ---

  private schemaNodeConfig(schema: SourceSchema, x: number, y: number, joinKeyField: string | null): Node.Metadata {
    const fields = [...schema.fields].sort((a, b) => a.order - b.order);
    const height = schemaBoxHeight(fields.length);
    return {
      id: srcId(schema.id),
      shape: 'rect',
      x,
      y,
      width: SCHEMA_BOX_WIDTH,
      height,
      zIndex: 2,
      data: { kind: 'sourceSchema', sourceSchemaId: schema.id, joinKeyField },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'rect', selector: 'titleBg' },
        { tagName: 'text', selector: 'titleText' },
        ...fields.map((_, i) => ({ tagName: 'text' as const, selector: `label-${i}` })),
      ],
      attrs: {
        body: { width: SCHEMA_BOX_WIDTH, height, fill: '#fff', stroke: '#1a73e8', strokeWidth: 1, rx: 6, ry: 6 },
        titleBg: { width: SCHEMA_BOX_WIDTH, height: TITLE_HEIGHT, fill: '#e8f0fe', stroke: '#1a73e8', strokeWidth: 1 },
        titleText: {
          text: schema.name,
          x: 8,
          y: TITLE_HEIGHT / 2 + TEXT_BASELINE_OFFSET,
          fontSize: 12,
          fontWeight: 600,
          textAnchor: 'start',
          refX: 0,
          refY: 0,
          fill: '#0d2b66',
        },
        ...Object.fromEntries(
          fields.map((f, i) => [
            `label-${i}`,
            {
              text: f.name,
              x: 8,
              y: TITLE_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 + TEXT_BASELINE_OFFSET,
              fontSize: 11,
              textAnchor: 'start',
              refX: 0,
              refY: 0,
              fill: '#333',
            },
          ])
        ),
      },
      ports: {
        groups: {
          out: {
            position: 'absolute',
            attrs: { circle: { r: 6, magnet: true, stroke: '#1a73e8', strokeWidth: 1, fill: '#1a73e8', cursor: 'crosshair' } },
          },
        },
        items: fields.map((f, i) => ({
          id: f.name,
          group: 'out',
          args: { x: SCHEMA_BOX_WIDTH, y: TITLE_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 },
        })),
      },
      tools: [{ name: 'button-remove', args: { x: '100%', y: 0, offset: { x: -8, y: 8 } } }],
    };
  }

  private targetNodeConfig(fileType: FileType, x: number, y: number): Node.Metadata {
    const fields = [...fileType.targetFields].sort((a, b) => a.order - b.order);
    const height = schemaBoxHeight(fields.length);
    return {
      id: TARGET_NODE_ID,
      shape: 'rect',
      x,
      y,
      width: SCHEMA_BOX_WIDTH,
      height,
      zIndex: 2,
      data: { kind: 'target' },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'rect', selector: 'titleBg' },
        { tagName: 'text', selector: 'titleText' },
        ...fields.map((_, i) => ({ tagName: 'text' as const, selector: `label-${i}` })),
      ],
      attrs: {
        body: { width: SCHEMA_BOX_WIDTH, height, fill: '#fff', stroke: '#2e7d32', strokeWidth: 1, rx: 6, ry: 6 },
        titleBg: { width: SCHEMA_BOX_WIDTH, height: TITLE_HEIGHT, fill: '#e8f5e9', stroke: '#2e7d32', strokeWidth: 1 },
        titleText: {
          text: fileType.name,
          x: 8,
          y: TITLE_HEIGHT / 2 + TEXT_BASELINE_OFFSET,
          fontSize: 12,
          fontWeight: 600,
          textAnchor: 'start',
          refX: 0,
          refY: 0,
          fill: '#1b5e20',
        },
        ...Object.fromEntries(
          fields.map((f, i) => [
            `label-${i}`,
            {
              text: f.name,
              x: 20,
              y: TITLE_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 + TEXT_BASELINE_OFFSET,
              fontSize: 11,
              textAnchor: 'start',
              refX: 0,
              refY: 0,
              fill: '#333',
            },
          ])
        ),
      },
      ports: {
        groups: {
          in: {
            position: 'absolute',
            attrs: { circle: { r: 6, magnet: true, stroke: '#2e7d32', strokeWidth: 1, fill: '#2e7d32', cursor: 'crosshair' } },
          },
        },
        items: fields.map((f, i) => ({
          id: f.name,
          group: 'in',
          args: { x: 0, y: TITLE_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 },
        })),
      },
    };
  }

  private functoidNodeConfig(
    id: string,
    functoidCode: string,
    x: number,
    y: number,
    params: Record<string, unknown> | null
  ): Node.Metadata {
    const def = this.functoidDefinitions.find((d) => d.code === functoidCode);
    const ports = def?.inputPorts?.length ? def.inputPorts : [{ name: 'value', label: 'Değer' }];
    const height = ports.length <= 1 ? NODE_HEIGHT : ports.length * 30;
    return {
      id: fnId(id),
      shape: 'rect',
      x,
      y,
      width: NODE_WIDTH,
      height,
      zIndex: 3,
      data: { kind: 'functoid', functoidNodeId: id, functoidCode, params: params ?? null },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: { width: NODE_WIDTH, height, fill: '#fff3e0', stroke: '#fb8c00', strokeWidth: 1, rx: 4, ry: 4 },
        label: {
          text: def?.name ?? functoidCode,
          x: NODE_WIDTH / 2,
          y: height / 2 + TEXT_BASELINE_OFFSET,
          fontSize: 12,
          fontWeight: 600,
          textAnchor: 'middle',
          refX: 0,
          refY: 0,
          fill: '#7a4a00',
        },
      },
      ports: {
        groups: {
          in: { position: 'absolute', attrs: { circle: { r: 6, magnet: true, stroke: '#fb8c00', strokeWidth: 1, fill: '#fb8c00' } } },
          out: { position: 'absolute', attrs: { circle: { r: 6, magnet: true, stroke: '#fb8c00', strokeWidth: 1, fill: '#fb8c00' } } },
        },
        items: [
          ...ports.map((p, i) => ({
            id: `in:${p.name}`,
            group: 'in',
            args: { x: 0, y: ((i + 0.5) * height) / ports.length },
          })),
          { id: 'out', group: 'out', args: { x: NODE_WIDTH, y: height / 2 } },
        ],
      },
      tools: [{ name: 'button-remove', args: { x: '100%', y: 0, offset: { x: -8, y: -8 } } }],
    };
  }

  private constantNodeConfig(id: string, value: string, x: number, y: number): Node.Metadata {
    return {
      id: constId(id),
      shape: 'rect',
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      zIndex: 3,
      data: { kind: 'constant', constantNodeId: id, value },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: { width: NODE_WIDTH, height: NODE_HEIGHT, fill: '#e8f5e9', stroke: '#43a047', strokeWidth: 1, rx: 4, ry: 4 },
        label: {
          text: value || 'Sabit değer',
          x: NODE_WIDTH / 2,
          y: NODE_HEIGHT / 2 + TEXT_BASELINE_OFFSET,
          fontSize: 12,
          textAnchor: 'middle',
          refX: 0,
          refY: 0,
          fill: value ? '#1b5e20' : '#8a9a8c',
          fontStyle: value ? 'normal' : 'italic',
        },
      },
      ports: {
        groups: {
          out: { position: 'absolute', attrs: { circle: { r: 6, magnet: true, stroke: '#43a047', strokeWidth: 1, fill: '#43a047' } } },
        },
        items: [{ id: 'out', group: 'out', args: { x: NODE_WIDTH, y: NODE_HEIGHT / 2 } }],
      },
      tools: [{ name: 'button-remove', args: { x: '100%', y: 0, offset: { x: -8, y: -8 } } }],
    };
  }

  // --- Palet sürükle-bırak ---

  onPaletteMouseDown(event: MouseEvent, code: string): void {
    event.preventDefault();
    const node = this.graph.createNode(this.functoidNodeConfig(randomId(), code, 0, 0, null));
    this.dnd.start(node, event);
  }

  // --- Node tıklama: parametre / sabit değer paneli ---

  private onNodeClick(node: Node): void {
    const data = node.getData<Record<string, unknown>>();
    if (data?.['kind'] === 'functoid') {
      if (this.paramPanel()?.nodeId === node.id) {
        this.paramPanel.set(null);
        return;
      }
      this.constantEdit.set(null);
      const pos = node.getPosition();
      const size = node.getSize();
      this.paramPanel.set({
        nodeId: node.id,
        x: pos.x,
        y: pos.y + size.height + 4,
        functoidCode: data['functoidCode'] as string,
        params: { ...((data['params'] as Record<string, unknown>) ?? {}) },
      });
    } else if (data?.['kind'] === 'constant') {
      if (this.constantEdit()?.nodeId === node.id) {
        this.constantEdit.set(null);
        return;
      }
      this.paramPanel.set(null);
      const pos = node.getPosition();
      this.constantEdit.set({ nodeId: node.id, x: pos.x, y: pos.y + NODE_HEIGHT + 4, value: (data['value'] as string) ?? '' });
    }
  }

  private repositionOverlays(): void {
    const panel = this.paramPanel();
    if (panel) {
      const node = this.graph.getCellById(panel.nodeId) as Node | undefined;
      if (node) {
        const pos = node.getPosition();
        const size = node.getSize();
        this.paramPanel.set({ ...panel, x: pos.x, y: pos.y + size.height + 4 });
      }
    }
    const edit = this.constantEdit();
    if (edit) {
      const node = this.graph.getCellById(edit.nodeId) as Node | undefined;
      if (node) {
        const pos = node.getPosition();
        this.constantEdit.set({ ...edit, x: pos.x, y: pos.y + NODE_HEIGHT + 4 });
      }
    }
  }

  functoidParams(code: string): FunctoidParameterDefinition[] {
    return this.functoidDefinitions.find((d) => d.code === code)?.parameters ?? [];
  }

  paramValue(key: string): string {
    const raw = this.paramPanel()?.params?.[key];
    return raw === undefined || raw === null ? '' : String(raw);
  }

  setParamValue(param: FunctoidParameterDefinition, raw: string): void {
    const panel = this.paramPanel();
    if (!panel) return;
    const node = this.graph.getCellById(panel.nodeId) as Node | undefined;
    if (!node) return;
    const value: unknown = param.type === 'number' ? Number(raw) : raw;
    const data = node.getData<Record<string, unknown>>();
    const params = { ...((data['params'] as Record<string, unknown>) ?? {}), [param.key]: value };
    node.setData({ ...data, params });
    this.paramPanel.set({ ...panel, params });
  }

  closeParamPanel(): void {
    this.paramPanel.set(null);
  }

  setConstantValue(raw: string): void {
    const edit = this.constantEdit();
    if (!edit) return;
    const node = this.graph.getCellById(edit.nodeId) as Node | undefined;
    if (!node) return;
    node.setData({ ...node.getData<Record<string, unknown>>(), value: raw });
    node.attr('label/text', raw || 'Sabit değer');
    node.attr('label/fill', raw ? '#1b5e20' : '#8a9a8c');
    node.attr('label/fontStyle', raw ? 'normal' : 'italic');
    this.constantEdit.set({ ...edit, value: raw });
  }

  closeConstantEdit(): void {
    this.constantEdit.set(null);
  }

  // --- Birleştirme anahtarı (join key) overlay'leri ---

  private refreshJoinKeySelectors(): void {
    const schemaNodes = this.graph.getNodes().filter((n) => n.getData<Record<string, unknown>>()?.['kind'] === 'sourceSchema');
    if (schemaNodes.length <= 1) {
      this.joinKeySelectors.set([]);
      return;
    }
    this.joinKeySelectors.set(
      schemaNodes.map((n) => {
        const data = n.getData<Record<string, unknown>>();
        const pos = n.getPosition();
        const schema = this.allSourceSchemas.find((s) => s.id === data['sourceSchemaId']);
        return {
          schemaId: data['sourceSchemaId'] as string,
          x: pos.x + SCHEMA_BOX_WIDTH - 96,
          y: pos.y + 4,
          value: (data['joinKeyField'] as string) ?? '',
          fields: (schema?.fields ?? []).map((f) => f.name),
        };
      })
    );
  }

  onJoinKeySelectChange(schemaId: string, value: string): void {
    const node = this.graph.getCellById(srcId(schemaId)) as Node | undefined;
    if (node) {
      node.setData({ ...node.getData<Record<string, unknown>>(), joinKeyField: value });
    }
    this.refreshJoinKeySelectors();
  }

  // --- Kaydetme/silme dışa açılan API ---

  addSourceSchema(schema: SourceSchema, x: number, y: number): void {
    if (this.graph.getCellById(srcId(schema.id))) return;
    this.graph.addNode(this.schemaNodeConfig(schema, x, y, null));
    this.refreshJoinKeySelectors();
  }

  removeSourceSchema(schemaId: string): void {
    const cell = this.graph.getCellById(srcId(schemaId));
    if (cell) this.graph.removeCell(cell);
  }

  addConstant(x: number, y: number): void {
    this.graph.addNode(this.constantNodeConfig(randomId(), '', x, y));
  }

  removeEdge(id: string): void {
    this.graph.removeCell(id);
  }

  getSourceSchemaIds(): string[] {
    return this.graph
      .getNodes()
      .map((n) => n.getData<Record<string, unknown>>())
      .filter((d) => d?.['kind'] === 'sourceSchema')
      .map((d) => d['sourceSchemaId'] as string);
  }

  describeEdges(): { id: string; from: string; to: string }[] {
    return this.graph.getEdges().map((edge) => {
      const ge = this.edgeCellToGraphEdge(edge);
      return { id: edge.id, from: this.describeFrom(ge), to: this.describeTo(ge) };
    });
  }

  // Dnd ile paletten bırakılan node'lar X6 tarafından kopyalanırken cell id'si
  // yeniden üretiliyor (fn:/const: önekimiz kaybolabiliyor); bu yüzden node'u
  // her zaman kendi domain id'mizi taşıyan `data` alanından buluyoruz, cell
  // id'sini yeniden inşa ederek değil.
  private findFunctoidCell(functoidNodeId: string): Node | undefined {
    return this.graph
      .getNodes()
      .find((n) => n.getData<Record<string, unknown>>()?.['kind'] === 'functoid' && n.getData<Record<string, unknown>>()?.['functoidNodeId'] === functoidNodeId);
  }

  private findConstantCell(constantNodeId: string): Node | undefined {
    return this.graph
      .getNodes()
      .find((n) => n.getData<Record<string, unknown>>()?.['kind'] === 'constant' && n.getData<Record<string, unknown>>()?.['constantNodeId'] === constantNodeId);
  }

  private describeFrom(edge: GraphEdge): string {
    if (edge.fromKind === 'SourceField') {
      const multiSource = this.getSourceSchemaIds().length > 1;
      const schema = this.allSourceSchemas.find((s) => s.id === edge.fromSourceSchemaId);
      return schema && multiSource ? `${schema.name}: ${edge.fromFieldName}` : (edge.fromFieldName ?? '?');
    }
    if (edge.fromKind === 'NodeOutput') {
      const node = this.findFunctoidCell(edge.fromNodeId ?? '');
      return (node?.getData<Record<string, unknown>>()?.['functoidCode'] as string) ?? '?';
    }
    const node = this.findConstantCell(edge.fromNodeId ?? '');
    const value = node?.getData<Record<string, unknown>>()?.['value'] as string | undefined;
    return value ? `"${value}"` : '?';
  }

  private describeTo(edge: GraphEdge): string {
    if (edge.toKind === 'TargetField') {
      return edge.toFieldName ?? '?';
    }
    const node = this.findFunctoidCell(edge.toNodeId ?? '');
    const code = node?.getData<Record<string, unknown>>()?.['functoidCode'];
    return node ? `${code}.${edge.toPort}` : '?';
  }

  getSnapshot(): MappingCanvasSnapshot {
    const sourceSchemas: SourceSchemaRefInput[] = [];
    const functoidNodes: FunctoidNode[] = [];
    const constantNodes: ConstantNode[] = [];

    for (const node of this.graph.getNodes()) {
      const data = node.getData<Record<string, unknown>>();
      if (!data) continue;
      const pos = node.getPosition();
      if (data['kind'] === 'sourceSchema') {
        sourceSchemas.push({
          sourceSchemaId: data['sourceSchemaId'] as string,
          joinKeyField: (data['joinKeyField'] as string) ?? null,
          positionX: pos.x,
          positionY: pos.y,
        });
      } else if (data['kind'] === 'functoid') {
        functoidNodes.push({
          id: data['functoidNodeId'] as string,
          functoidCode: data['functoidCode'] as string,
          params: (data['params'] as Record<string, unknown>) ?? null,
          positionX: pos.x,
          positionY: pos.y,
        });
      } else if (data['kind'] === 'constant') {
        constantNodes.push({
          id: data['constantNodeId'] as string,
          value: (data['value'] as string) ?? '',
          positionX: pos.x,
          positionY: pos.y,
        });
      }
    }

    return { sourceSchemas, functoidNodes, constantNodes, edges: this.graph.getEdges().map((e) => this.edgeCellToGraphEdge(e)) };
  }

  private loadSnapshot(snapshot: MappingCanvasSnapshot): void {
    const previousSuppress = this.suppress;
    this.suppress = true;

    for (const cell of [...this.graph.getNodes(), ...this.graph.getEdges()]) {
      if (cell.id !== TARGET_NODE_ID) {
        this.graph.removeCell(cell);
      }
    }
    this.paramPanel.set(null);
    this.constantEdit.set(null);

    for (const ref of snapshot.sourceSchemas) {
      const schema = this.allSourceSchemas.find((s) => s.id === ref.sourceSchemaId);
      if (!schema) continue;
      this.graph.addNode(this.schemaNodeConfig(schema, ref.positionX, ref.positionY, ref.joinKeyField));
    }
    for (const fn of snapshot.functoidNodes) {
      this.graph.addNode(this.functoidNodeConfig(fn.id, fn.functoidCode, fn.positionX, fn.positionY, fn.params ?? null));
    }
    for (const c of snapshot.constantNodes) {
      this.graph.addNode(this.constantNodeConfig(c.id, c.value, c.positionX, c.positionY));
    }

    for (const edge of snapshot.edges) {
      const source = this.edgeEndpointToCellPort(edge, true);
      const target = this.edgeEndpointToCellPort(edge, false);
      if (!source || !target) continue;
      this.graph.addEdge({
        id: edge.id,
        source: { cell: source.cellId, port: source.portId },
        target: { cell: target.cellId, port: target.portId },
        attrs: { line: { stroke: '#1a73e8', strokeWidth: 2, targetMarker: null } },
        zIndex: 0,
      });
    }

    this.refreshJoinKeySelectors();
    this.suppress = previousSuppress;
    if (!this.suppress) {
      this.emitGraphChanged();
    }
  }

  private edgeEndpointToCellPort(edge: GraphEdge, isFrom: boolean): { cellId: string; portId: string } | null {
    const kind = isFrom ? edge.fromKind : edge.toKind;
    switch (kind) {
      case 'SourceField': {
        if (!edge.fromSourceSchemaId || !edge.fromFieldName) return null;
        return { cellId: srcId(edge.fromSourceSchemaId), portId: edge.fromFieldName };
      }
      case 'TargetField': {
        if (!edge.toFieldName) return null;
        return { cellId: TARGET_NODE_ID, portId: edge.toFieldName };
      }
      case 'NodeOutput': {
        if (!edge.fromNodeId) return null;
        return { cellId: fnId(edge.fromNodeId), portId: 'out' };
      }
      case 'ConstantOutput': {
        if (!edge.fromNodeId) return null;
        return { cellId: constId(edge.fromNodeId), portId: 'out' };
      }
      case 'NodeInput': {
        if (!edge.toNodeId || !edge.toPort) return null;
        return { cellId: fnId(edge.toNodeId), portId: `in:${edge.toPort}` };
      }
      default:
        return null;
    }
  }

  private edgeCellToGraphEdge(edge: Edge): GraphEdge {
    const from = this.decodeEndpoint(edge.getSourceCell() as Node | null, edge.getSourcePortId(), true);
    const to = this.decodeEndpoint(edge.getTargetCell() as Node | null, edge.getTargetPortId(), false);
    return {
      id: edge.id,
      fromKind: from.kind,
      fromSourceSchemaId: from.sourceSchemaId ?? null,
      fromFieldName: from.fieldName ?? null,
      fromNodeId: from.nodeId ?? null,
      toKind: to.kind,
      toNodeId: to.nodeId ?? null,
      toPort: to.port ?? null,
      toFieldName: to.fieldName ?? null,
    };
  }

  // X6'nın Dnd ile bırakılan node'ların cell id'sini yeniden üretmesi
  // yüzünden (bkz. findFunctoidCell) burada da cell id'sini değil, node'un
  // `data` alanındaki kendi domain id'mizi kaynak alıyoruz.
  private decodeEndpoint(
    cell: Node | null,
    portId: string | undefined,
    isFrom: boolean
  ): { kind: EdgeEndpointKind; sourceSchemaId?: string; fieldName?: string; nodeId?: string; port?: string } {
    const fallback: EdgeEndpointKind = isFrom ? 'SourceField' : 'TargetField';
    if (!cell || !portId) {
      return { kind: fallback };
    }
    const data = cell.getData<Record<string, unknown>>() ?? {};
    if (data['kind'] === 'sourceSchema') {
      return { kind: 'SourceField', sourceSchemaId: data['sourceSchemaId'] as string, fieldName: portId };
    }
    if (data['kind'] === 'target') {
      return { kind: 'TargetField', fieldName: portId };
    }
    if (data['kind'] === 'functoid') {
      const nodeId = data['functoidNodeId'] as string;
      return portId === 'out' ? { kind: 'NodeOutput', nodeId } : { kind: 'NodeInput', nodeId, port: portId.slice(3) };
    }
    if (data['kind'] === 'constant') {
      return { kind: 'ConstantOutput', nodeId: data['constantNodeId'] as string };
    }
    return { kind: fallback };
  }

  private dedupeIncomingEdges(edge: Edge): void {
    const targetCellId = edge.getTargetCellId();
    const targetPortId = edge.getTargetPortId();
    if (!targetCellId || !targetPortId) return;
    const targetCell = this.graph.getCellById(targetCellId) as Node | undefined;
    if (!targetCell) return;
    this.graph
      .getIncomingEdges(targetCell)
      ?.filter((e) => e.id !== edge.id && e.getTargetPortId() === targetPortId)
      .forEach((e) => this.graph.removeEdge(e.id));
  }
}
