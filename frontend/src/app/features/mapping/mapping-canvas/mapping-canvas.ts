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
import { Edge, Graph, Node } from '@antv/x6';
import { Dnd } from '@antv/x6-plugin-dnd';
import { Snapline } from '@antv/x6-plugin-snapline';
import { FileType } from '../../../core/models/file-type.model';
import { ConstantNode, EdgeEndpointKind, FunctoidNode, GraphEdge } from '../../../core/models/mapping.model';
import { FunctoidDefinition, FunctoidParameterDefinition } from '../../../core/models/functoid.model';
import { SourceSchema } from '../../../core/models/source-schema.model';

export interface SourceSchemaRefInput {
  sourceSchemaId: string;
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

export interface SuggestedFieldMatch {
  sourceFields: string[];
  targetField: string;
  functoidCode: string | null;
  padChar?: string | null;
  length?: number | null;
}

interface SuggestionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface SuggestionOverlay {
  key: string;
  sourceFields: string[];
  targetField: string;
  functoidCode: string | null;
  // Sadece "kutu" (box) node'unun parametreleri - Concat vb. icin hep null
  // (bkz. acceptSuggestion), LPad/RPad icin backend'den gelen {length, padChar}.
  params: Record<string, unknown> | null;
  // Terminal (box/functoidCode) node'undan ONCE zincirlenen ikinci bir functoid
  // (su an icin sadece 'Trim', LPad/RPad onerileriyle birlikte geliyor) - Trim'in
  // parametresi olmadigi icin ayri bir params alanina gerek yok.
  chainFunctoidCode: 'Trim' | null;
  chainBox: SuggestionBox | null;
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  box: SuggestionBox | null;
  controlsX: number;
  controlsY: number;
  // Kullanici bir functoid-onerisinin (Concat vb.) ghost kutusunu elle
  // surukleyince buraya yazilan goreceli kaydirma - otomatik konum hesabi
  // (node hareketiyle tetiklenen recompute dahil) her zaman bunun USTUNE
  // uygulaniyor, boylece elle tasima kalici kaliyor. Bir zincirdeki iki kutu
  // da AYNI offset'i paylasiyor (birlikte tasiniyor, bagimsiz surukleme yok).
  manualOffset: { dx: number; dy: number } | null;
}

const TITLE_HEIGHT = 30;
const ROW_HEIGHT = 28;
const SCHEMA_BOX_WIDTH = 220;
const NODE_WIDTH = 120;
const NODE_HEIGHT = 36;
const CANVAS_WIDTH = 1400;
const MIN_CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 900;
// Node'lar bu sinirlarin disina suruklenirse canvas ne kadar buyuyecegini
// hesaplarken eklenen bosluk pay - kenara yapismasin diye.
const CANVAS_GROWTH_MARGIN = 40;
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

// Functoid isimleri (ör. "Trim (Bas/Son Bosluk Kirp)") sabit NODE_WIDTH'ten
// (140px) uzun olabiliyor ve SVG text kutunun disina taşiyordu. Karakter
// sayisina gore genislik hesaplayip metne gore buyuyen bir kutu kullaniyoruz;
// kisa isimler icin yine NODE_WIDTH'te kaliyor.
function functoidNodeWidth(label: string): number {
  return Math.max(NODE_WIDTH, label.length * 6.5 + 20);
}

@Component({
  selector: 'app-mapping-canvas',
  imports: [],
  templateUrl: './mapping-canvas.html',
  styleUrl: './mapping-canvas.scss',
})
export class MappingCanvas implements AfterViewInit, OnChanges, OnDestroy {
  @Input() functoidDefinitions: FunctoidDefinition[] = [];
  @Input() targetFileType: FileType | null = null;
  @Input() allSourceSchemas: SourceSchema[] = [];
  // Yetkisi olmayan roller (Viewer/Approver) canvas'i acabilsin ama hicbir
  // sey suruklenemesin/baglanamasin/silinemesin diye - degeri bilesenin
  // omru boyunca sabit (kullanicinin rolu oturum icinde degismiyor), o
  // yuzden sadece Graph kurulurken bir kere okunuyor.
  @Input() viewOnly = false;

  @Input()
  set initialSnapshot(snapshot: MappingCanvasSnapshot | null) {
    this.pendingSnapshot = snapshot;
    this.tryHydrate();
  }

  @Output() readonly graphChanged = new EventEmitter<void>();
  // Bagalanti listesinden (mapping-editor.html'deki .connection-list) hangi
  // baglantinin secili oldugunu bulmak zordu - Ece'nin istegi (2026-08-24):
  // canvas'ta bir baglanti cizgisine tiklayinca listede karsiligi
  // vurgulansin. Bu output sadece tiklanan edge'in id'sini (ya da bos alana
  // tiklaninca secim kalktigi icin null) disari veriyor, secimin GORSEL
  // (kalin/renkli cizgi) hali burada kaliyor - liste tarafi sadece hangi
  // satirin vurgulanacagini biliyor.
  @Output() readonly edgeSelected = new EventEmitter<string | null>();

  @ViewChild('canvasHost', { static: true }) canvasHostRef!: ElementRef<HTMLDivElement>;

  private graph!: Graph;
  private dnd!: Dnd;
  private pendingSnapshot: MappingCanvasSnapshot | null = null;
  private hydrated = false;
  private suppress = false;
  // acceptSuggestion/attachFunctoidToSuggestion kendi Trim/Pad node'larini
  // programatik olarak eklerken de 'node:added' tetikleniyor -
  // tryAttachToNearbyConnection bu YENI node'u, halen bekleyen BASKA bir
  // AI onerisinin cizgisine "yakin" bulup o oneriyi de sessizce/istemsiz
  // onaylayabiliyordu (Ece'nin canli yakaladigi bug: bir oneriyi onaylamak
  // yakinindaki baska bir oneriyi de ayni functoid node'una kaynastiriyordu).
  // Bu bayrak sadece kullanicinin paletten GERCEKTEN surukleyip biraktigi
  // node'larda calismasi gereken bu kisayolu, bizim kendi programatik
  // addNode cagrilarimiz sirasinda devre disi birakiyor.
  private suppressAutoAttach = false;
  // edgeSelected/onEdgeClick ile ayni ozellik - secili edge'in cizgisini
  // kalinlastirip renklendirmek icin id'sini tutuyoruz, boylece baska bir
  // edge'e tiklaninca ya da bos alana tiklaninca eskisini varsayilan
  // renge/kaline geri dondurebiliyoruz.
  private highlightedEdgeId: string | null = null;
  private canvasWidth = CANVAS_WIDTH;
  private canvasHeight = CANVAS_HEIGHT;
  private readonly onWindowResize = (): void => this.handleWindowResize();
  private draggingSuggestion: { key: string; startClientX: number; startClientY: number; baseOffset: { dx: number; dy: number } } | null = null;
  private readonly onSuggestionPointerMove = (event: PointerEvent): void => this.handleSuggestionPointerMove(event);
  private readonly onSuggestionPointerUp = (): void => this.handleSuggestionPointerUp();

  // Signal olarak tutuluyor: X6'nın kendi event bus'ı zone.js tarafından
  // sarmalanmıyor, düz property mutasyonları Angular change detection'ı
  // tetiklemiyordu (parametre paneli state'i doluyordu ama template hiç
  // güncellenmiyordu). Signal write'ları zone'dan bağımsız CD tetikler.
  readonly paramPanel = signal<ParamPanelState | null>(null);
  readonly constantEdit = signal<ConstantEditState | null>(null);
  readonly suggestions = signal<SuggestionOverlay[]>([]);

  ngAfterViewInit(): void {
    this.suppress = true;
    this.canvasWidth = this.computeCanvasWidth();
    this.graph = new Graph({
      container: this.canvasHostRef.nativeElement,
      width: this.canvasWidth,
      height: this.canvasHeight,
      panning: false,
      mousewheel: false,
      interacting: !this.viewOnly,
      connecting: {
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        snap: true,
        validateConnection: ({ sourceMagnet, targetMagnet, sourceCell, targetCell }) => {
          if (this.viewOnly) return false;
          if (!sourceMagnet || !targetMagnet) return false;
          if (sourceCell === targetCell) return false;
          return sourceMagnet.getAttribute('port-group') === 'out' && targetMagnet.getAttribute('port-group') === 'in';
        },
        createEdge: () =>
          this.graph.createEdge({
            attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
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
    this.graph.on('edge:removed', ({ edge }) => {
      if (this.highlightedEdgeId === edge.id) {
        this.highlightedEdgeId = null;
        this.edgeSelected.emit(null);
      }
      this.emitGraphChanged();
    });
    this.graph.on('edge:click', ({ edge }) => this.onEdgeClick(edge));
    this.graph.on('node:added', ({ node }) => {
      if (!this.suppress && !this.suppressAutoAttach) {
        this.tryAttachToNearbyConnection(node);
      }
      this.applyCanvasSize(this.canvasWidth, this.canvasHeight);
      this.emitGraphChanged();
    });
    this.graph.on('node:removed', ({ node }) => {
      this.graph.getConnectedEdges(node).forEach((e) => this.graph.removeEdge(e.id));
      // Onceden HANGI node silinirse silinsin tum bekleyen AI onerileri
      // temizleniyordu - ilgisiz bir functoid/sabit deger node'u silmek bile
      // alakasiz onerileri yok ediyordu. Oneriler sadece kaynak semanin
      // alanlarina/pozisyonuna dayandigi icin, gecersiz olmalari sadece kaynak
      // sema node'unun kendisi silindiginde soz konusu.
      if (node.getData<Record<string, unknown>>()?.['kind'] === 'sourceSchema') {
        this.suggestions.set([]);
      }
      this.emitGraphChanged();
    });
    this.graph.on('node:change:position', () => {
      this.repositionOverlays();
      this.applyCanvasSize(this.canvasWidth, this.canvasHeight);
      this.emitGraphChanged();
    });
    this.graph.on('node:click', ({ node }) => this.onNodeClick(node));
    this.graph.on('blank:click', () => {
      this.paramPanel.set(null);
      this.constantEdit.set(null);
      this.setHighlightedEdge(null);
      this.edgeSelected.emit(null);
    });

    this.rebuildTargetNode();
    this.tryHydrate();

    window.addEventListener('resize', this.onWindowResize);

    // İlk kurulumda eklenen hedef node/olası hydration, parent'ın @ViewChild
    // referansı henüz atanmadan senkron event fırlatmasın diye bildirim bir
    // sonraki microtask'a erteleniyor (tek seferlik emit burada yapılır).
    queueMicrotask(() => {
      this.suppress = false;
      this.emitGraphChanged();
    });
  }

  // Sabit 1400px genişlik, canvas-host-wrapper'ın gerçekte gösterdiği alandan
  // daha geniş olabiliyor ve hedef şema kutusunu görebilmek için yatay kaydırma
  // gerektiriyordu. Bunun yerine wrapper'ın (flex ile büyüyen) o anki genişliği
  // ölçülüp canvas ona göre boyutlandırılıyor.
  private computeCanvasWidth(): number {
    const wrapper = this.canvasHostRef.nativeElement.parentElement;
    const available = wrapper?.clientWidth ?? CANVAS_WIDTH;
    return Math.max(available, MIN_CANVAS_WIDTH);
  }

  private handleWindowResize(): void {
    if (!this.graph) return;
    const width = this.computeCanvasWidth();
    if (width === this.canvasWidth) return;
    this.applyCanvasSize(width, this.canvasHeight);
    this.repositionTargetNode();
  }

  // Canvas'in piksel boyutu sadece pencere genisligine gore degil, icindeki
  // node'larin gercekte nerede oldugua gore de belirleniyor - bir node bugune
  // kadar sabit olan alanin disina suruklenirse (orn. hedef kutusunu saga
  // tasimak), .canvas-host-wrapper'in scroll alani hala eski/kucuk boyutta
  // kaldigi icin o node'a bir daha scroll ile ulasilamiyordu. Bu metod her
  // zaman "adaydan buyuk olani" uyguluyor - asla kucultmuyor (bir node'u geri
  // tasisan bile canvas kuculmuyor; otomatik kucultme baska node'lari kirpma
  // riski tasidigi icin bilincli olarak yapilmiyor).
  private applyCanvasSize(candidateWidth: number, candidateHeight: number): void {
    if (!this.graph) return;
    const extent = this.contentExtent();
    const width = Math.max(candidateWidth, extent.width);
    const height = Math.max(candidateHeight, extent.height);
    if (width === this.canvasWidth && height === this.canvasHeight) return;
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.graph.resize(this.canvasWidth, this.canvasHeight);
  }

  private contentExtent(): { width: number; height: number } {
    const nodes = this.graph.getNodes();
    if (nodes.length === 0) return { width: 0, height: 0 };
    const maxX = Math.max(...nodes.map((n) => n.getPosition().x + n.getSize().width));
    const maxY = Math.max(...nodes.map((n) => n.getPosition().y + n.getSize().height));
    return { width: maxX + CANVAS_GROWTH_MARGIN, height: maxY + CANVAS_GROWTH_MARGIN };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targetFileType'] && this.graph) {
      this.rebuildTargetNode();
      this.tryHydrate();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('pointermove', this.onSuggestionPointerMove);
    document.removeEventListener('pointerup', this.onSuggestionPointerUp);
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
    const x = this.canvasWidth - SCHEMA_BOX_WIDTH - 60;
    this.graph.addNode(this.targetNodeConfig(this.targetFileType, x, 20));
  }

  // Sadece pencere yeniden boyutlandiginda hedef kutusunu sag kenara yasli
  // tutmak icin - rebuildTargetNode()'un aksine node'u SILMIYOR, sadece
  // tasiyor. Bug: handleWindowResize() eskiden rebuildTargetNode()
  // cagiriyordu, o da node'u silip ayni ID'yle yeniden ekliyordu - X6'da bir
  // node silinince ona bagli TUM edge'ler (gelen dahil) de otomatik siliniyor.
  // Sonuc: DevTools acip pencere genisligi degisince, hedef alana giden butun
  // baglantilar canvas'tan VE baglanti listesinden sessizce kayboluyordu
  // (kaynak->node baglantilari etkilenmiyordu, cunku onlarin node'u
  // silinmiyordu - sadece hedef node'a bagli olanlar gidiyordu). position()
  // ile tasima, X6'nin edge'leri portlarina gore otomatik takip etmesini
  // saglar, hicbir edge kopmaz.
  // node:change:position handler'i her tasimada emitGraphChanged() cagiriyor
  // (bkz. ngAfterViewInit) - bu, GERCEK bir kullanici surukleme'siyle aymi
  // kod yolunu paylasiyor. Hedef kutusunun x/y'si zaten kaydedilen snapshot'in
  // (getSnapshot()) bir parcasi DEGIL - sadece pencere genisligine gore
  // hesaplanan gorsel bir konumlandirma. Bu yuzden burada suppress ile
  // sarmalamazsak, salt REVIEW icin bir mapping'i acmis biri (canvas'a hic
  // dokunmadan) pencere/DevTools boyutu degisince mapping-editor.ts'te
  // isDirty=true'ya dusuyordu - Onayla/Reddet sonrasi "kaydedilmemis
  // degisiklikleriniz var" diye gercek disi bir uyari cikip navigasyonu
  // engelliyordu (Ece'nin sunum sirasinda canli yasadigi bug, 2026-08-24).
  private repositionTargetNode(): void {
    const existing = this.graph.getCellById(TARGET_NODE_ID) as Node | undefined;
    if (!existing) {
      return;
    }
    const previousSuppress = this.suppress;
    this.suppress = true;
    const x = this.canvasWidth - SCHEMA_BOX_WIDTH - 60;
    existing.position(x, 20);
    this.suppress = previousSuppress;
  }

  // --- Node config üreticileri ---

  private schemaNodeConfig(schema: SourceSchema, x: number, y: number): Node.Metadata {
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
      data: { kind: 'sourceSchema', sourceSchemaId: schema.id },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'rect', selector: 'titleBg' },
        { tagName: 'text', selector: 'titleText' },
        ...fields.map((_, i) => ({ tagName: 'text' as const, selector: `label-${i}` })),
      ],
      attrs: {
        body: { width: SCHEMA_BOX_WIDTH, height, fill: '#fff', stroke: '#1a1a1a', strokeWidth: 2, rx: 8, ry: 8 },
        titleBg: { width: SCHEMA_BOX_WIDTH, height: TITLE_HEIGHT, fill: '#1a1a1a', stroke: '#1a1a1a', strokeWidth: 2 },
        titleText: {
          text: schema.name,
          x: 8,
          y: TITLE_HEIGHT / 2 + TEXT_BASELINE_OFFSET,
          fontSize: 12,
          fontWeight: 600,
          textAnchor: 'start',
          refX: 0,
          refY: 0,
          fill: '#ffffff',
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
            attrs: { circle: { r: 6, magnet: true, stroke: '#56708a', strokeWidth: 1, fill: '#56708a', cursor: 'crosshair' } },
          },
        },
        items: fields.map((f, i) => ({
          id: f.name,
          group: 'out',
          args: { x: SCHEMA_BOX_WIDTH, y: TITLE_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 },
        })),
      },
      tools: this.viewOnly ? [] : [{ name: 'button-remove', args: { x: '100%', y: 0, offset: { x: -8, y: 8 } } }],
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
        body: { width: SCHEMA_BOX_WIDTH, height, fill: '#fff', stroke: '#2e7d32', strokeWidth: 2, rx: 8, ry: 8 },
        titleBg: { width: SCHEMA_BOX_WIDTH, height: TITLE_HEIGHT, fill: '#2e7d32', stroke: '#2e7d32', strokeWidth: 2 },
        titleText: {
          text: fileType.name,
          x: 8,
          y: TITLE_HEIGHT / 2 + TEXT_BASELINE_OFFSET,
          fontSize: 12,
          fontWeight: 600,
          textAnchor: 'start',
          refX: 0,
          refY: 0,
          fill: '#ffffff',
        },
        ...Object.fromEntries(
          fields.map((f, i) => [
            `label-${i}`,
            {
              text: f.isRequired ? `${f.name} *` : f.name,
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
            attrs: { circle: { r: 6, magnet: true, stroke: '#56708a', strokeWidth: 1, fill: '#56708a', cursor: 'crosshair' } },
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
    // Kutuda sadece kisa kod adi (ör. "Trim") gosteriliyor - tam Turkce
    // aciklama ("Trim (Bas/Son Bosluk Kirp)") kutuyu gereksiz genisletiyordu.
    // Tam aciklama, uzerine gelince gorunen native bir SVG <title> tooltip'i
    // olarak korunuyor - palet listesindeki chip'ler hala tam ismi gosteriyor,
    // orada hangi functoid'i sececegini bilmek onemli.
    const label = def?.code ?? functoidCode;
    const fullName = def?.name ?? functoidCode;
    const ports = def?.inputPorts?.length ? def.inputPorts : [{ name: 'value', label: 'Değer' }];
    const height = ports.length <= 1 ? NODE_HEIGHT : ports.length * 30;
    const width = functoidNodeWidth(label);
    return {
      id: fnId(id),
      shape: 'rect',
      x,
      y,
      width,
      height,
      zIndex: 3,
      data: { kind: 'functoid', functoidNodeId: id, functoidCode, params: params ?? null },
      markup: [
        { tagName: 'title', selector: 'tooltip' },
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        tooltip: { text: fullName },
        body: { width, height, fill: '#fff3e0', stroke: '#fb8c00', strokeWidth: 1, rx: 4, ry: 4 },
        label: {
          text: label,
          x: width / 2,
          y: height / 2 + TEXT_BASELINE_OFFSET,
          fontSize: 14,
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
          { id: 'out', group: 'out', args: { x: width, y: height / 2 } },
        ],
      },
      tools: this.viewOnly ? [] : [{ name: 'button-remove', args: { x: '100%', y: 0, offset: { x: -8, y: -8 } } }],
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
      tools: this.viewOnly ? [] : [{ name: 'button-remove', args: { x: '100%', y: 0, offset: { x: -8, y: -8 } } }],
    };
  }

  // --- Palet sürükle-bırak ---

  onPaletteMouseDown(event: MouseEvent, code: string): void {
    if (this.viewOnly) return;
    event.preventDefault();
    const node = this.graph.createNode(this.functoidNodeConfig(randomId(), code, 0, 0, null));
    this.dnd.start(node, event);
  }

  // --- Node tıklama: parametre / sabit değer paneli ---

  private onNodeClick(node: Node): void {
    if (this.viewOnly) return;
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
    if (this.suggestions().length > 0) {
      this.recomputeSuggestionPositions();
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
    this.emitGraphChanged();
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
    this.emitGraphChanged();
  }

  closeConstantEdit(): void {
    this.constantEdit.set(null);
  }

  // --- Kaydetme/silme dışa açılan API ---

  // Tek kaynak semaya sinirlandirildigi icin (bkz. proje karari - multi-source
  // mapping kaldirildi) zaten bir kaynak varsa yenisi eklenmiyor. mapping-editor
  // tarafinda da "+ Kaynak Ekle" bir kaynak eklendikten sonra disabled oluyor,
  // ama bu guard burada da savunma amacli tekrarlaniyor.
  addSourceSchema(schema: SourceSchema, x: number, y: number): void {
    if (this.viewOnly) return;
    if (this.getSourceSchemaIds().length > 0) return;
    if (this.graph.getCellById(srcId(schema.id))) return;
    this.graph.addNode(this.schemaNodeConfig(schema, x, y));
  }

  removeSourceSchema(schemaId: string): void {
    const cell = this.graph.getCellById(srcId(schemaId));
    if (cell) this.graph.removeCell(cell);
  }

  // --- AI eslestirme onerileri (kalici degil - onaylanmadan graph'a yazilmaz) ---

  get overlayWidth(): number {
    return this.canvasWidth;
  }

  get overlayHeight(): number {
    return this.canvasHeight;
  }

  showSuggestions(matches: SuggestedFieldMatch[]): void {
    const schemaNode = this.graph.getNodes().find((n) => n.getData<Record<string, unknown>>()?.['kind'] === 'sourceSchema');
    const targetNode = this.graph.getCellById(TARGET_NODE_ID) as Node | undefined;

    if (!schemaNode || !targetNode) {
      this.suggestions.set([]);
      return;
    }

    const schemaId = schemaNode.getData<Record<string, unknown>>()?.['sourceSchemaId'] as string;
    const schema = this.allSourceSchemas.find((s) => s.id === schemaId);
    if (!schema || !this.targetFileType) {
      this.suggestions.set([]);
      return;
    }

    const srcFields = [...schema.fields].sort((a, b) => a.order - b.order);
    const tgtFields = [...this.targetFileType.targetFields].sort((a, b) => a.order - b.order);
    // Zaten kalici bir baglantisi olan alanlara oneri gosterme - kafa karistirmasin.
    const connectedTargetPorts = new Set(
      this.graph.getEdges().map((e) => e.getTargetPortId()).filter((p): p is string => !!p)
    );
    const connectedSourcePorts = new Set(
      this.graph.getEdges().map((e) => e.getSourcePortId()).filter((p): p is string => !!p)
    );

    const overlays: SuggestionOverlay[] = [];
    for (const m of matches) {
      if (m.sourceFields.length === 0) continue;
      if (m.sourceFields.some((f) => connectedSourcePorts.has(f)) || connectedTargetPorts.has(m.targetField)) continue;

      const sourceIndices = m.sourceFields.map((f) => srcFields.findIndex((sf) => sf.name === f));
      const targetIndex = tgtFields.findIndex((f) => f.name === m.targetField);
      if (sourceIndices.some((i) => i < 0) || targetIndex < 0) continue;

      overlays.push(
        m.functoidCode === 'LPad' || m.functoidCode === 'RPad'
          ? this.buildChainedSuggestionOverlay(
              schemaNode, targetNode, sourceIndices[0], targetIndex, m.sourceFields[0], m.targetField,
              m.functoidCode, { length: m.length, padChar: m.padChar }, null
            )
          : m.functoidCode
            ? this.buildFunctoidSuggestionOverlay(schemaNode, targetNode, sourceIndices, targetIndex, m.sourceFields, m.targetField, m.functoidCode, null)
            : this.buildDirectSuggestionOverlay(schemaNode, targetNode, sourceIndices[0], targetIndex, m.sourceFields[0], m.targetField)
      );
    }

    this.suggestions.set(overlays);
  }

  acceptSuggestion(s: SuggestionOverlay): void {
    const schemaNode = this.graph.getNodes().find((n) => n.getData<Record<string, unknown>>()?.['kind'] === 'sourceSchema');
    if (!schemaNode) return;

    // Onceden (node eklemeden ONCE) listeden cikariyoruz - kendi onerisinin
    // (s) cizgisine tekrar "yakin" bulunup sonsuz ozyinelemeye girmesin diye.
    // Ayrica suppressAutoAttach ile 'node:added'in tryAttachToNearbyConnection
    // kismini asagidaki TUM addNode cagrilari icin kapatiyoruz - yoksa aynen
    // s'de oldugu gibi, HALA bekleyen BASKA bir oneri de (rastgele yakin
    // konumlandiysa) burada eklenen node'a istemsizce kaynasabiliyordu (Ece'nin
    // canli yakaladigi bug: bir oneriyi onaylamak yaninda duran baska bir
    // oneriyi de sessizce onayliyordu).
    this.suggestions.update((list) => list.filter((x) => x.key !== s.key));
    this.suppressAutoAttach = true;

    if (s.chainFunctoidCode && s.chainBox && s.functoidCode && s.box) {
      // Trim -> Pad zinciri: kaynak alan -> Trim -> Pad -> hedef, iki ayri
      // functoid node'u ve aralarindaki tek girdi portlarina gore kurulmus
      // uc edge (bkz. proje karari - LPad/RPad'in onune her zaman Trim gelir).
      const trimPorts = this.functoidDefinitions.find((d) => d.code === s.chainFunctoidCode)?.inputPorts ?? [];
      const padPorts = this.functoidDefinitions.find((d) => d.code === s.functoidCode)?.inputPorts ?? [];

      const trimNodeId = randomId();
      this.graph.addNode(this.functoidNodeConfig(trimNodeId, s.chainFunctoidCode, s.chainBox.x, s.chainBox.y, null));
      this.graph.addEdge({
        source: { cell: schemaNode.id, port: s.sourceFields[0] },
        target: { cell: fnId(trimNodeId), port: `in:${trimPorts[0]?.name ?? 'value'}` },
        attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
        zIndex: 0,
      });

      const padNodeId = randomId();
      this.graph.addNode(this.functoidNodeConfig(padNodeId, s.functoidCode, s.box.x, s.box.y, s.params));
      this.graph.addEdge({
        source: { cell: fnId(trimNodeId), port: 'out' },
        target: { cell: fnId(padNodeId), port: `in:${padPorts[0]?.name ?? 'value'}` },
        attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
        zIndex: 0,
      });
      this.graph.addEdge({
        source: { cell: fnId(padNodeId), port: 'out' },
        target: { cell: TARGET_NODE_ID, port: s.targetField },
        attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
        zIndex: 0,
      });
    } else if (s.functoidCode && s.box) {
      const functoidNodeId = randomId();
      this.graph.addNode(this.functoidNodeConfig(functoidNodeId, s.functoidCode, s.box.x, s.box.y, null));
      const ports = this.functoidDefinitions.find((d) => d.code === s.functoidCode)?.inputPorts ?? [];
      s.sourceFields.forEach((field, i) => {
        this.graph.addEdge({
          source: { cell: schemaNode.id, port: field },
          target: { cell: fnId(functoidNodeId), port: `in:${ports[i]?.name ?? 'value'}` },
          attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
          zIndex: 0,
        });
      });
      this.graph.addEdge({
        source: { cell: fnId(functoidNodeId), port: 'out' },
        target: { cell: TARGET_NODE_ID, port: s.targetField },
        attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
        zIndex: 0,
      });
    } else {
      this.graph.addEdge({
        source: { cell: schemaNode.id, port: s.sourceFields[0] },
        target: { cell: TARGET_NODE_ID, port: s.targetField },
        attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
        zIndex: 0,
      });
    }

    this.suppressAutoAttach = false;
    this.emitGraphChanged();
  }

  rejectSuggestion(s: SuggestionOverlay): void {
    this.suggestions.update((list) => list.filter((x) => x.key !== s.key));
  }

  clearSuggestions(): void {
    this.suggestions.set([]);
  }

  // Bir functoid-onerisinin (Concat vb.) ghost kutusunu elle surukleme - oneriler
  // X6 cell'i olmadigi icin (bkz. SuggestionOverlay), X6'nin kendi surukleme
  // sistemine binemiyoruz, duz pointer event'lerle kendimiz takip ediyoruz.
  // Direkt (cizgi) oneriler kapsam disi (`s.box` yoksa hicbir sey yapmiyor).
  startDraggingSuggestion(s: SuggestionOverlay, event: PointerEvent): void {
    if (!s.functoidCode || !s.box) return;
    event.preventDefault();
    event.stopPropagation();
    this.draggingSuggestion = {
      key: s.key,
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseOffset: s.manualOffset ?? { dx: 0, dy: 0 },
    };
    document.addEventListener('pointermove', this.onSuggestionPointerMove);
    document.addEventListener('pointerup', this.onSuggestionPointerUp);
  }

  private handleSuggestionPointerMove(event: PointerEvent): void {
    const drag = this.draggingSuggestion;
    if (!drag) return;
    this.applyManualOffset(drag.key, {
      dx: drag.baseOffset.dx + (event.clientX - drag.startClientX),
      dy: drag.baseOffset.dy + (event.clientY - drag.startClientY),
    });
  }

  private handleSuggestionPointerUp(): void {
    document.removeEventListener('pointermove', this.onSuggestionPointerMove);
    document.removeEventListener('pointerup', this.onSuggestionPointerUp);
    this.draggingSuggestion = null;
  }

  // recomputeSuggestionPositions ile ayni node-lookup/rebuild deseni, ama tek
  // bir oneriyi verilen manualOffset ile yeniden kuruyor - surukleme sirasinda
  // her pointermove'da sadece o oneri guncelleniyor, digerlerine dokunulmuyor.
  private applyManualOffset(key: string, offset: { dx: number; dy: number }): void {
    const schemaNode = this.graph.getNodes().find((n) => n.getData<Record<string, unknown>>()?.['kind'] === 'sourceSchema');
    const targetNode = this.graph.getCellById(TARGET_NODE_ID) as Node | undefined;
    if (!schemaNode || !targetNode) return;

    const schemaId = schemaNode.getData<Record<string, unknown>>()?.['sourceSchemaId'] as string;
    const schema = this.allSourceSchemas.find((s) => s.id === schemaId);
    if (!schema || !this.targetFileType) return;

    const srcFields = [...schema.fields].sort((a, b) => a.order - b.order);
    const tgtFields = [...this.targetFileType.targetFields].sort((a, b) => a.order - b.order);

    this.suggestions.update((list) =>
      list.map((s) => {
        if (s.key !== key || !s.functoidCode) return s;
        const sourceIndices = s.sourceFields.map((f) => srcFields.findIndex((sf) => sf.name === f));
        const targetIndex = tgtFields.findIndex((f) => f.name === s.targetField);
        if (sourceIndices.some((i) => i < 0) || targetIndex < 0) return s;
        // Bir zincirdeki iki kutu (Trim+Pad) AYNI offset'i paylasip birlikte
        // tasiniyor - bagimsiz surukleme yok.
        return s.chainFunctoidCode
          ? this.buildChainedSuggestionOverlay(schemaNode, targetNode, sourceIndices[0], targetIndex, s.sourceFields[0], s.targetField, s.functoidCode, s.params, offset)
          : this.buildFunctoidSuggestionOverlay(schemaNode, targetNode, sourceIndices, targetIndex, s.sourceFields, s.targetField, s.functoidCode, offset);
      })
    );
  }

  // Paletten suruklenip bir baglantiya (bekleyen AI onerisi YA DA zaten gercek
  // olan bir edge) yakin bir yere birakilan tek-girdili bir functoid'i, elle
  // reddet/kes-yapistir yapmaya gerek kalmadan aranin icine otomatik yerlestirir.
  // Ece'nin kararı (bkz. proje hafizasi): bir oneriye eklenen functoid ANINDA
  // gercek oluyor (geciktirilmis onay yok - bankacilik baglaminda "ekranda ne
  // varsa odur" ilkesi ve veri kaybi riski nedeniyle bilincli tercih) - ama bu
  // ayni kisayolun GERCEK baglantilar uzerinde de calismasini engellememeli,
  // yoksa bir baglantiya sadece BIR kez bu kisayolla functoid eklenebilirdi.
  // Iki aday havuzu birlikte degerlendirilip GERCEKTEN en yakin olan kazanir.
  private tryAttachToNearbyConnection(node: Node): void {
    const data = node.getData<Record<string, unknown>>();
    if (data?.['kind'] !== 'functoid') return;

    const def = this.functoidDefinitions.find((d) => d.code === (data['functoidCode'] as string));
    if (!def || def.inputPorts.length !== 1) return;

    const pos = node.getPosition();
    const size = node.getSize();
    const cx = pos.x + size.width / 2;
    const cy = pos.y + size.height / 2;
    const TOLERANCE = 40;

    let suggestionMatch: SuggestionOverlay | null = null;
    let suggestionDistance = Infinity;
    for (const s of this.suggestions()) {
      if (s.sourceFields.length === 0) continue;
      const distance = Math.min(...s.lines.map((l) => this.distanceToSegment(cx, cy, l.x1, l.y1, l.x2, l.y2)));
      if (distance <= TOLERANCE && distance < suggestionDistance) {
        suggestionMatch = s;
        suggestionDistance = distance;
      }
    }

    let edgeMatch: Edge | null = null;
    let edgeDistance = Infinity;
    for (const edge of this.graph.getEdges()) {
      const sp = edge.getSourcePoint();
      const tp = edge.getTargetPoint();
      const distance = this.distanceToSegment(cx, cy, sp.x, sp.y, tp.x, tp.y);
      if (distance <= TOLERANCE && distance < edgeDistance) {
        edgeMatch = edge;
        edgeDistance = distance;
      }
    }

    if (!suggestionMatch && !edgeMatch) return;

    if (edgeMatch && (!suggestionMatch || edgeDistance <= suggestionDistance)) {
      this.spliceFunctoidIntoEdge(edgeMatch, node, def);
      return;
    }

    this.attachFunctoidToSuggestion(suggestionMatch!, node, def);
  }

  // Zaten gercek olan bir edge'in (kabul edilmis oneri ya da elle kurulmus,
  // fark etmez) arasina yeni bir functoid ekler: eski edge silinir, ayni
  // uclarla iki yeni edge kurulur (kaynak -> yeni functoid -> eski hedef).
  private spliceFunctoidIntoEdge(edge: Edge, node: Node, def: FunctoidDefinition): void {
    const source = edge.getSource() as { cell?: string; port?: string };
    const target = edge.getTarget() as { cell?: string; port?: string };
    if (!source.cell || !target.cell) return;

    this.graph.removeEdge(edge.id);
    this.graph.addEdge({
      source: { cell: source.cell, port: source.port },
      target: { cell: node.id, port: `in:${def.inputPorts[0].name}` },
      attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
      zIndex: 0,
    });
    this.graph.addEdge({
      source: { cell: node.id, port: 'out' },
      target: { cell: target.cell, port: target.port },
      attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
      zIndex: 0,
    });
  }

  private attachFunctoidToSuggestion(match: SuggestionOverlay, node: Node, def: FunctoidDefinition): void {
    const schemaNode = this.graph.getNodes().find((n) => n.getData<Record<string, unknown>>()?.['kind'] === 'sourceSchema');
    if (!schemaNode) return;

    let sourceCellId = schemaNode.id;
    let sourcePort = match.sourceFields[0];

    if (match.functoidCode && match.box) {
      const suggestedDef = this.functoidDefinitions.find((d) => d.code === match.functoidCode);
      // match.params kullaniliyor (null degil) - LPad/RPad onerisi icin bu
      // backend'in hesapladigi gercek {length, padChar}, null birakilirsa
      // functoid hicbir sey yapmayan bir no-op'a doner. Not: bu yol (bekleyen
      // bir oneriye baska bir functoid surukleyip eklemek) chainFunctoidCode'u
      // (Trim) henuz ayrica kurmuyor - LPad/RPad onerisi uzerine boyle bir
      // eklem yapilirsa Trim adimi atlanmis olur; kapsam disi birakildi, kabul
      // dugmesi (acceptSuggestion) uzerinden gecen normal akis her zaman dogru.
      const suggestedFunctoidId = randomId();
      // Bu addNode da programatik - ayni suppressAutoAttach korumasi (bkz.
      // acceptSuggestion'daki ayni gerekce) burada da gerekli.
      this.suppressAutoAttach = true;
      this.graph.addNode(this.functoidNodeConfig(suggestedFunctoidId, match.functoidCode, match.box.x, match.box.y, match.params));
      this.suppressAutoAttach = false;
      const suggestedPorts = suggestedDef?.inputPorts ?? [];
      match.sourceFields.forEach((field, i) => {
        this.graph.addEdge({
          source: { cell: schemaNode.id, port: field },
          target: { cell: fnId(suggestedFunctoidId), port: `in:${suggestedPorts[i]?.name ?? 'value'}` },
          attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
          zIndex: 0,
        });
      });
      sourceCellId = fnId(suggestedFunctoidId);
      sourcePort = 'out';
    }

    this.graph.addEdge({
      source: { cell: sourceCellId, port: sourcePort },
      target: { cell: node.id, port: `in:${def.inputPorts[0].name}` },
      attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
      zIndex: 0,
    });
    this.graph.addEdge({
      source: { cell: node.id, port: 'out' },
      target: { cell: TARGET_NODE_ID, port: match.targetField },
      attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
      zIndex: 0,
    });
    this.suggestions.update((list) => list.filter((x) => x.key !== match.key));
  }

  private distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    return Math.hypot(px - closestX, py - closestY);
  }

  private buildDirectSuggestionOverlay(
    schemaNode: Node,
    targetNode: Node,
    sourceFieldIndex: number,
    targetFieldIndex: number,
    sourceField: string,
    targetField: string
  ): SuggestionOverlay {
    const srcPos = schemaNode.getPosition();
    const tgtPos = targetNode.getPosition();
    const x1 = srcPos.x + SCHEMA_BOX_WIDTH;
    const y1 = srcPos.y + TITLE_HEIGHT + sourceFieldIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const x2 = tgtPos.x;
    const y2 = tgtPos.y + TITLE_HEIGHT + targetFieldIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    return {
      key: `${sourceField}->${targetField}`,
      sourceFields: [sourceField],
      targetField,
      functoidCode: null,
      params: null,
      chainFunctoidCode: null,
      chainBox: null,
      lines: [{ x1, y1, x2, y2 }],
      box: null,
      controlsX: (x1 + x2) / 2,
      controlsY: (y1 + y2) / 2,
      // Direkt onerilerin iki ucu da sabit alan portlarina bagli - tasinacak
      // serbest bir konumlari yok, bu yuzden bilerek her zaman null.
      manualOffset: null,
    };
  }

  // Kaynak alanlari bir functoid uzerinden hedefe baglayan oneri (ör. Concat ile
  // Ad+Soyad -> AdSoyad). Kutu boyutu, gercekten kabul edilince olusacak functoid
  // node'uyla ayni mantikla (functoidNodeConfig) hesaplaniyor ki onizleme yaniltici
  // olmasin.
  private buildFunctoidSuggestionOverlay(
    schemaNode: Node,
    targetNode: Node,
    sourceFieldIndices: number[],
    targetFieldIndex: number,
    sourceFields: string[],
    targetField: string,
    functoidCode: string,
    manualOffset: { dx: number; dy: number } | null
  ): SuggestionOverlay {
    const srcPos = schemaNode.getPosition();
    const tgtPos = targetNode.getPosition();
    const srcX = srcPos.x + SCHEMA_BOX_WIDTH;
    const tgtX = tgtPos.x;
    const tgtY = tgtPos.y + TITLE_HEIGHT + targetFieldIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const srcYs = sourceFieldIndices.map((i) => srcPos.y + TITLE_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2);

    const { width, height, label } = this.functoidBoxSize(functoidCode, sourceFields.length);
    // Otomatik ("dogal") konum once hesaplaniyor, kullanicinin elle uyguladigi
    // kaydirma (varsa) en son ustune ekleniyor - boylece bir node hareket edip
    // dogal konum degisse bile, kullanicinin GORECELI ayarlamasi kaliyor.
    const boxX = (srcX + tgtX) / 2 - width / 2 + (manualOffset?.dx ?? 0);
    const boxY = srcYs.reduce((a, b) => a + b, 0) / srcYs.length - height / 2 + (manualOffset?.dy ?? 0);

    const lines = srcYs.map((y1, i) => ({
      x1: srcX,
      y1,
      x2: boxX,
      y2: boxY + ((i + 0.5) * height) / srcYs.length,
    }));
    lines.push({ x1: boxX + width, y1: boxY + height / 2, x2: tgtX, y2: tgtY });

    return {
      key: `${sourceFields.join('+')}->${targetField}`,
      sourceFields,
      targetField,
      functoidCode,
      params: null,
      chainFunctoidCode: null,
      chainBox: null,
      lines,
      box: { x: boxX, y: boxY, width, height, label },
      controlsX: boxX + width,
      controlsY: boxY + height / 2,
      manualOffset,
    };
  }

  // LPad/RPad onerisi - tek kaynak alani, onune otomatik zincirlenen bir Trim
  // uzerinden hedefe baglar (bkz. proje karari - MappingExecutor Length asimini
  // gercek bir hata olarak firlatiyor, trimlenmemis bosluk pad'i bozabilir).
  // buildFunctoidSuggestionOverlay ile ayni kutu-boyutu mantigini (functoidBoxSize)
  // iki kutu icin ayri ayri kullanir; kaynak-Trim-Pad-hedef araligini esit
  // ucte bir'lere bolerek yerlestirir.
  private buildChainedSuggestionOverlay(
    schemaNode: Node,
    targetNode: Node,
    sourceFieldIndex: number,
    targetFieldIndex: number,
    sourceField: string,
    targetField: string,
    functoidCode: string,
    params: Record<string, unknown> | null,
    manualOffset: { dx: number; dy: number } | null
  ): SuggestionOverlay {
    const srcPos = schemaNode.getPosition();
    const tgtPos = targetNode.getPosition();
    const srcX = srcPos.x + SCHEMA_BOX_WIDTH;
    const tgtX = tgtPos.x;
    const tgtY = tgtPos.y + TITLE_HEIGHT + targetFieldIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const srcY = srcPos.y + TITLE_HEIGHT + sourceFieldIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

    const trim = this.functoidBoxSize('Trim', 1);
    const pad = this.functoidBoxSize(functoidCode, 1);
    const dx = manualOffset?.dx ?? 0;
    const dy = manualOffset?.dy ?? 0;

    const span = tgtX - srcX;
    const trimBox: SuggestionBox = {
      x: srcX + span / 3 - trim.width / 2 + dx,
      y: srcY - trim.height / 2 + dy,
      width: trim.width,
      height: trim.height,
      label: trim.label,
    };
    const padBox: SuggestionBox = {
      x: srcX + (2 * span) / 3 - pad.width / 2 + dx,
      y: srcY - pad.height / 2 + dy,
      width: pad.width,
      height: pad.height,
      label: pad.label,
    };

    const lines = [
      { x1: srcX, y1: srcY, x2: trimBox.x, y2: trimBox.y + trimBox.height / 2 },
      { x1: trimBox.x + trimBox.width, y1: trimBox.y + trimBox.height / 2, x2: padBox.x, y2: padBox.y + padBox.height / 2 },
      { x1: padBox.x + padBox.width, y1: padBox.y + padBox.height / 2, x2: tgtX, y2: tgtY },
    ];

    return {
      key: `${sourceField}->${targetField}`,
      sourceFields: [sourceField],
      targetField,
      functoidCode,
      params,
      chainFunctoidCode: 'Trim',
      chainBox: trimBox,
      lines,
      box: padBox,
      controlsX: padBox.x + padBox.width,
      controlsY: padBox.y + padBox.height / 2,
      manualOffset,
    };
  }

  // functoidNodeConfig'teki boyut hesabinin ayni kopyasi (kabul-oncesi onizleme,
  // kabul-sonrasi gercek node'la ayni boyutta gorunsun diye).
  private functoidBoxSize(code: string, portCountHint: number): { width: number; height: number; label: string } {
    const def = this.functoidDefinitions.find((d) => d.code === code);
    const label = def?.code ?? code;
    const portCount = def?.inputPorts?.length || portCountHint || 1;
    const height = portCount <= 1 ? NODE_HEIGHT : portCount * 30;
    const width = functoidNodeWidth(label);
    return { width, height, label };
  }

  private recomputeSuggestionPositions(): void {
    const schemaNode = this.graph.getNodes().find((n) => n.getData<Record<string, unknown>>()?.['kind'] === 'sourceSchema');
    const targetNode = this.graph.getCellById(TARGET_NODE_ID) as Node | undefined;
    if (!schemaNode || !targetNode) return;

    const schemaId = schemaNode.getData<Record<string, unknown>>()?.['sourceSchemaId'] as string;
    const schema = this.allSourceSchemas.find((s) => s.id === schemaId);
    if (!schema || !this.targetFileType) return;

    const srcFields = [...schema.fields].sort((a, b) => a.order - b.order);
    const tgtFields = [...this.targetFileType.targetFields].sort((a, b) => a.order - b.order);

    this.suggestions.update((list) =>
      list.map((s) => {
        const sourceIndices = s.sourceFields.map((f) => srcFields.findIndex((sf) => sf.name === f));
        const targetIndex = tgtFields.findIndex((f) => f.name === s.targetField);
        if (sourceIndices.some((i) => i < 0) || targetIndex < 0) return s;
        return s.chainFunctoidCode && s.functoidCode
          ? this.buildChainedSuggestionOverlay(schemaNode, targetNode, sourceIndices[0], targetIndex, s.sourceFields[0], s.targetField, s.functoidCode, s.params, s.manualOffset)
          : s.functoidCode
            ? this.buildFunctoidSuggestionOverlay(schemaNode, targetNode, sourceIndices, targetIndex, s.sourceFields, s.targetField, s.functoidCode, s.manualOffset)
            : this.buildDirectSuggestionOverlay(schemaNode, targetNode, sourceIndices[0], targetIndex, s.sourceFields[0], s.targetField);
      })
    );
  }

  addConstant(x: number, y: number): void {
    if (this.viewOnly) return;
    this.graph.addNode(this.constantNodeConfig(randomId(), '', x, y));
  }

  removeEdge(id: string): void {
    if (this.viewOnly) return;
    this.graph.removeCell(id);
  }

  private onEdgeClick(edge: Edge): void {
    this.setHighlightedEdge(edge.id);
    this.edgeSelected.emit(edge.id);
  }

  // Butun edge'ler ayni varsayilan renk/kalinlikla olusturuluyor
  // (bkz. createEdge/attachEdge cagrilari, '#56708a' / strokeWidth 2), o
  // yuzden eski secimi bu sabit degerlere geri dondurmek guvenli.
  private setHighlightedEdge(id: string | null): void {
    if (this.highlightedEdgeId) {
      const prev = this.graph.getCellById(this.highlightedEdgeId);
      if (prev) {
        prev.attr('line/stroke', '#56708a');
        prev.attr('line/strokeWidth', 2);
      }
    }
    this.highlightedEdgeId = id;
    if (id) {
      const next = this.graph.getCellById(id);
      if (next) {
        // styles.scss'teki --mat-sys-tertiary (VakifBank altin rengi) ile ayni
        // ton - X6 SVG'ye dogrudan attr basiyor, CSS custom property'yi burada
        // kullanamiyoruz.
        next.attr('line/stroke', '#ffc72c');
        next.attr('line/strokeWidth', 3);
      }
    }
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
      return edge.fromFieldName ?? '?';
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

  // Hedef kutusu disindaki HER SEYI (kaynak sema kutulari, functoid/sabit
  // deger node'lari, tum baglantilar) temizliyor - loadSnapshot()'in zaten
  // yaptigi ilk adimin disari cikarilmis hali (asagida onu da kullanir).
  // mapping-editor.ts'teki confirmHedef() de bunu Urun/Dosya Tipi
  // DEGISTIRILDIGINDE (var olan bir hedef zaten varken) kullaniyor - eskiden
  // sadece MappingEditor'un KENDI usedSourceSchemaIds/connections sinyalleri
  // sifirlaniyordu, canvas'taki gercek X6 node'lari yerinde kalip yeni hedefe
  // "yetim" olarak asili kaliyordu (Ece'nin istegiyle yapilan kapsamli
  // taramada bulunan pre-existing bug, bkz. [[project_known_minor_issues]]
  // madde 5 - 2026-07-21'den beri bilinen bir rahatsizlikti).
  clearSourceContent(): void {
    const previousSuppress = this.suppress;
    this.suppress = true;

    for (const cell of [...this.graph.getNodes(), ...this.graph.getEdges()]) {
      if (cell.id !== TARGET_NODE_ID) {
        this.graph.removeCell(cell);
      }
    }
    this.paramPanel.set(null);
    this.constantEdit.set(null);
    this.suggestions.set([]);
    this.setHighlightedEdge(null);

    this.suppress = previousSuppress;
    if (!this.suppress) {
      this.emitGraphChanged();
    }
  }

  private loadSnapshot(snapshot: MappingCanvasSnapshot): void {
    const previousSuppress = this.suppress;
    this.suppress = true;

    this.clearSourceContent();

    for (const ref of snapshot.sourceSchemas) {
      const schema = this.allSourceSchemas.find((s) => s.id === ref.sourceSchemaId);
      if (!schema) continue;
      this.graph.addNode(this.schemaNodeConfig(schema, ref.positionX, ref.positionY));
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
        attrs: { line: { stroke: '#56708a', strokeWidth: 2, targetMarker: null } },
        zIndex: 0,
      });
    }

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
