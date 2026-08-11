import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ProductService } from '../../../core/services/product.service';
import { SourceSchemaService } from '../../../core/services/source-schema.service';
import { MappingService } from '../../../core/services/mapping.service';
import { FunctoidService } from '../../../core/services/functoid.service';
import { FieldMatchSuggestionService } from '../../../core/services/field-match-suggestion.service';
import { FileType } from '../../../core/models/file-type.model';
import { FunctoidDefinition } from '../../../core/models/functoid.model';
import { Product } from '../../../core/models/product.model';
import { SourceSchema } from '../../../core/models/source-schema.model';
import { MappingCanvas, MappingCanvasSnapshot } from '../mapping-canvas/mapping-canvas';
import { MappingList } from '../mapping-list/mapping-list';
import { SourceSchemaList } from '../../source-schemas/source-schema-list/source-schema-list';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-mapping-editor',
  imports: [
    FormsModule,
    RouterLink,
    MappingCanvas,
    MappingList,
    SourceSchemaList,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './mapping-editor.html',
  styleUrl: './mapping-editor.scss',
})
export class MappingEditor implements OnInit, HasUnsavedChanges {
  private readonly productService = inject(ProductService);
  private readonly sourceSchemaService = inject(SourceSchemaService);
  private readonly mappingService = inject(MappingService);
  private readonly functoidService = inject(FunctoidService);
  private readonly fieldMatchSuggestionService = inject(FieldMatchSuggestionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  mappingId: string | null = null;
  readonly loadingExisting = signal(false);

  readonly showMappingsPanel = signal(false);
  readonly showSourceSchemaModal = signal(false);
  readonly showSavePopup = signal(false);
  readonly hedefExpanded = signal(true);
  // hedefExpanded sadece Hedef panelinin GÖRSEL açık/kapalı durumunu tutuyor;
  // panel tekrar açılıp kapansa bile Kaynaklar/canvas'in bir kere acildiktan
  // sonra kapanmamasi icin ayri, "yapiskan" (sticky) bir bayrak gerekiyor —
  // yoksa Hedef'i incelemek icin tekrar acmak canvas'i (ve uzerindeki tum
  // kaydedilmemis calismayi) yok edip yeniden yaratiyordu.
  readonly hedefConfirmedOnce = signal(false);
  // Ayni "yapiskan" mantik bir adim daha ileri tasiniyor: canvas gorsel
  // olarak sadece ilk kaynak eklendiginde aciliyor, ama <app-mapping-canvas>
  // component'i hedef onaylanir onaylanmaz DOM'da kalmaya devam ediyor
  // (yoksa "Kaynak Ekle" butonunun ekleyecegi bir canvas referansi olmazdi).
  // Bir kaynak eklendikten sonra hepsini silse bile canvas tekrar gizlenmiyor.
  readonly canvasRevealed = signal(false);

  @ViewChild('canvas') canvas!: MappingCanvas;
  @ViewChild('schemaSelectRef', { read: ElementRef }) schemaSelectRef?: ElementRef<HTMLSelectElement>;

  readonly products = signal<Product[]>([]);
  readonly fileTypes = signal<FileType[]>([]);
  // Canvas'a gecen, GERCEKTEN uygulanmis (Onayla ile onaylanmis) hedef dosya
  // tipi. `selectedFileType` (asagida getter) ise sadece dropdown'daki o anki
  // secimi yansitir - Onayla'ya basilana kadar ikisi farkli olabilir. Canvas
  // [targetFileType] input'u bilerek activeFileType'a bagli, selectedFileType'a
  // degil: aksi halde dropdown'da secim yapmak (Onayla'ya basmadan) hedefi
  // hemen silip yeniden kurar, tek bir onay sorusu yerine her secimde sorardik.
  readonly activeFileType = signal<FileType | null>(null);
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
  readonly suggestingMatches = signal(false);
  readonly suggestError = signal<string | null>(null);

  // Kaydet butonu, saveMapping()'in zaten reddedecegi bir durumu (hedef
  // yok/kaynak yok/hic baglanti yok) kullaniciya oncesinde gostermeden
  // acmasin diye - eskiden buton her zaman tiklanabiliyordu, hicbir sey
  // secilmemisken bile "Mapping Adi" popup'ini acip sonra "zorunlu" hatasi
  // veriyordu.
  readonly canSave = computed(
    () => this.hedefConfirmedOnce() && this.usedSourceSchemaIds().length > 0 && this.connections().length > 0 && !this.saving()
  );

  // Canvas hydrate/olusturma sonrasi (bkz. mapping-canvas.ts ngAfterViewInit)
  // her zaman bir kerelik "hazir" bildirimi geliyor - bu, taze yuklenmis ya
  // da az once Hedef'i onaylanmis bos bir mapping'i yanlislikla "kirli"
  // isaretlememek icin bir sonraki onGraphChanged() cagrisini yutuyor.
  readonly isDirty = signal(false);
  private awaitingInitialGraphReady = false;

  selectedProductId = '';
  selectedFileTypeId = '';
  newSourceSchemaId = '';

  mappingName = '';
  readonly saving = signal(false);

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
    // Onay/iptal kontrolu burada DEGIL - unsavedChangesGuard (core/guards/
    // unsaved-changes.guard.ts) mapping/edit/:id -> mapping/edit/:id gecisleri
    // dahil TUM navigasyonlarda calisiyor (ampirik olarak dogrulandi: Angular
    // ayni route config'te sadece :id degisince component instance'ini yeniden
    // kullansa bile CanDeactivate guard'i atlamiyor). Burada tekrar sormak
    // kullaniciya ayni onay penceresini iki kez gostermeye yol aciyordu.
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

  // routerLink="/mapping" zaten /mapping'deyken tıklanırsa Angular Router'ın
  // varsayılan `onSameUrlNavigation: 'ignore'` davranışı yüzünden hiçbir şey
  // yapmıyor (paramMap yeniden emit edilmiyor). Bu yüzden "+ Yeni Mapping"
  // butonları formu doğrudan da sıfırlıyor; edit ekranından geliniyorsa
  // routerLink'in tetikleyeceği resetForNewMapping() ile bu ikinci çağrı
  // sorunsuzca çakışıyor (idempotent).
  async startNewMapping(): Promise<void> {
    this.showMappingsPanel.set(false);

    if (this.isEditMode) {
      // Farkli bir route'a (mapping/edit/:id -> mapping) gercek bir navigasyon
      // olacak; state'i burada ELLE sifirlamiyoruz - CanDeactivate guard
      // (core/guards/unsaved-changes.guard.ts) devreye girip soracak, guard
      // olmadan burada resetlersek guard hic calismadan veri zaten silinmis olur.
      return;
    }

    // Zaten /mapping'deyken routerLink="/mapping" Router'in
    // onSameUrlNavigation:'ignore' davranisi yuzunden navigasyon/guard hic
    // tetiklenmiyor - kontrolu burada elle yapiyoruz.
    if (!(await this.confirmDiscardIfDirty())) return;
    this.resetForNewMapping();
  }

  private resetForNewMapping(): void {
    this.mappingId = null;
    this.mappingName = '';
    this.selectedProductId = '';
    this.selectedFileTypeId = '';
    this.fileTypes.set([]);
    this.rawPendingSnapshot.set(null);
    this.error.set(null);
    this.showSavePopup.set(false);
    this.hedefExpanded.set(true);
    this.hedefConfirmedOnce.set(false);
    this.canvasRevealed.set(false);
    this.activeFileType.set(null);
    this.resetGraphState();
    this.awaitingInitialGraphReady = false;
    this.isDirty.set(false);
  }

  private loadExistingMapping(id: string): void {
    this.loadingExisting.set(true);

    this.mappingService.getById(id).subscribe({
      next: (mapping) => {
        this.mappingName = mapping.name;

        // hedefConfirmedOnce'i sifirlamak, template'teki
        // `@if (hedefConfirmedOnce())` bloğunu anlik olarak kapatip
        // app-mapping-canvas'i yok edip yeniden yaratmasini sagliyor. Bu,
        // kayitli bir mapping acikken baska bir kayitli mapping'e gecerken
        // gerekli: MappingCanvas'in tek seferlik `hydrated` bayragi ayni
        // component instance'i canli kaldigi surece ikinci snapshot'in hic
        // yuklenmemesine yol aciyordu (eski node/edge'ler ekranda kalip
        // yenileri hic gelmiyordu). Onceden bu is selectedFileTypeId/fileTypes'i
        // temizlemekle yapiliyordu, ama hedef/kaynak wizard'i canvas'in gorunurlugunu
        // hedefConfirmedOnce'e bagladiktan sonra o eski temizlik artik canvas'i hic
        // kapatmiyordu - ayni bug farkli bir sinyalden geri gelmisti.
        this.selectedFileTypeId = '';
        this.fileTypes.set([]);
        this.hedefConfirmedOnce.set(false);
        this.resetGraphState();
        this.canvasRevealed.set(mapping.sourceSchemas.length > 0);

        this.rawPendingSnapshot.set({
          sourceSchemas: mapping.sourceSchemas.map((s) => ({
            sourceSchemaId: s.sourceSchemaId,
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
                this.activeFileType.set(fileType);
                this.hedefExpanded.set(false);
                this.awaitingInitialGraphReady = true;
                this.hedefConfirmedOnce.set(true);
                this.isDirty.set(false);
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
      error: (err: HttpErrorResponse) => {
        // 404 (mapping silinmis - orn. "Kayitli Mapping'ler" panelinden, ayni
        // mapping baska bir yerde acikken) genel "API calisiyor mu?" mesajini
        // gostermek yanlis yonlendiriyordu - API gayet calisiyor, sadece bu
        // mapping artik yok. Ayrica sadece loadingExisting'i kapatip mappingId'yi
        // eski (artik gecersiz) degerinde birakmak, sayfa basligini hala
        // "Mapping Duzenle" gostermeye devam ettiriyordu, hicbir sey
        // yuklenmemis olsa bile - resetForNewMapping() ile temiz bir "yeni
        // mapping" durumuna donuyoruz, hata mesaji ustte gorunur kaliyor.
        this.loadingExisting.set(false);
        if (err.status === 404) {
          // Sira onemli: resetForNewMapping() kendi icinde error.set(null)
          // yapiyor, o yuzden mesaji ANCAK reset'ten SONRA yaziyoruz -
          // aksi halde reset mesaji hemen siliyordu.
          this.resetForNewMapping();
          this.error.set('Bu mapping artık mevcut değil (silinmiş olabilir).');
        } else {
          this.error.set('Mapping yüklenemedi. API çalışıyor mu?');
        }
      },
    });
  }

  // Urun/Dosya Tipi'ni degistirmek artik BURADA hicbir sey silmiyor - sadece
  // dropdown'daki secimi ve Dosya Tipi listesini gunceller. Hedefi/canvas'i
  // gercekten degistirmek (ve gerekiyorsa TEK bir onay sorusu sormak)
  // confirmHedef()'e ("Onayla") tasindi - iki ayri dropdown'da iki ayri soru
  // sormak yerine, kullanici Ürün+Dosya Tipi'ni serbestce degistirip Onayla'ya
  // bastiginda bir kere soruluyor.
  onProductChange(): void {
    this.selectedFileTypeId = '';
    this.fileTypes.set([]);
    this.hedefExpanded.set(true);

    if (!this.selectedProductId) {
      return;
    }

    this.productService.getFileTypesByProductId(this.selectedProductId).subscribe({
      next: (fileTypes) => this.fileTypes.set(fileTypes),
      error: () => this.error.set('Dosya tipleri yüklenemedi. API çalışıyor mu?'),
    });
  }

  // Dirty durumda geri donulemez bir islem (yeni mapping baslatma, mapping
  // degistirme, route degisikligi) yapilmadan once kullaniciya soruyor.
  // ConfirmService (app-confirm-dialog) native confirm() yerine uygulamanin
  // kendi gorunumune uyan bir pencere gosteriyor - Promise donduruyor.
  private confirmDiscardIfDirty(): Promise<boolean> {
    return !this.isDirty()
      ? Promise.resolve(true)
      : this.confirmService.confirm('Kaydedilmemiş değişiklikleriniz var. Devam ederseniz kaybolacaklar. Emin misiniz?');
  }

  // unsavedChangesGuard (core/guards/unsaved-changes.guard.ts) tarafindan
  // gercek route navigasyonlarinda (ornegin Onizleme'ye gecis) cagriliyor.
  // CanDeactivateFn Promise<boolean> donusunu destekliyor.
  canDeactivate(): Promise<boolean> {
    return this.confirmDiscardIfDirty();
  }

  // canDeactivate SADECE Angular Router navigasyonlarinda calisiyor - sayfa
  // yenileme (F5) ya da sekmeyi/pencereyi kapatma bunun disinda, tarayicinin
  // kendi native uyarisi gerekiyor. Mesaj metni tarayici tarafindan sabitlendigi
  // icin (guvenlik nedeniyle, modern tarayicilar ozel metne izin vermiyor)
  // sadece preventDefault() cagirmak yeterli - tarayici kendi genel "kaydedilmemis
  // degisiklikler olabilir" uyarisini gosteriyor.
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
    }
  }

  // Hedef paneli sadece "Onayla" ile kapanıyor (bkz. mapping-editor.html),
  // ürün/dosya tipi seçmek tek başına paneli küçültmüyor. hedefConfirmedOnce
  // "yapışkan" (sticky): Hedef paneli daha sonra tekrar açılıp incelense bile
  // Kaynaklar/canvas kapanmıyor — sadece ilk açılışı burada tetikleniyor.
  //
  // Hedefi GERCEKTEN degistirme (canvas'i sifirlayip yeni hedefi kurma) ve
  // buna bagli tek onay sorusu da burada oluyor - dropdown'larda secim yapmak
  // (onProductChange/[(ngModel)]) hicbir sey silmiyor, sadece burada "Onayla"
  // ile commit ediliyor.
  async confirmHedef(): Promise<void> {
    const newFileType = this.selectedFileType;
    if (!newFileType) return;

    const isFirstConfirm = !this.hedefConfirmedOnce();
    const targetChanging = this.activeFileType()?.id !== newFileType.id;

    // Ilk onaydan sonraki her degisiklik (yani zaten bir hedef/canvas varken
    // farkli bir Urun/Dosya Tipi'ne gecmek) mevcut hedef baglantilarini ve
    // kaynak/canvas yapisini sifirliyor - isDirty olsun ya da olmasin, çünkü
    // bu zaten kurulmus/kayitli bir eslesmeyi yok ediyor. Hedef gercekten
    // degismiyorsa (ayni dosya tipi tekrar onaylandi) sormaya gerek yok.
    if (targetChanging && !isFirstConfirm) {
      const confirmed = await this.confirmService.confirm(
        'Ürün/Dosya Tipi değiştirmek mevcut hedef alan bağlantılarını ve kaynak/canvas yapılandırmasını sıfırlayacak. Devam etmek istediğinize emin misiniz?'
      );
      if (!confirmed) return;
    }

    this.hedefExpanded.set(false);

    if (targetChanging) {
      this.resetGraphState();
      this.activeFileType.set(newFileType);
    }

    if (isFirstConfirm) {
      this.awaitingInitialGraphReady = true;
    }
    this.hedefConfirmedOnce.set(true);
  }

  // hedefExpanded artik canvas/Kaynaklar gorunurlugunu etkilemiyor (bkz.
  // hedefConfirmedOnce), bu yuzden başlığa serbestçe ac/kapa yapmak guvenli —
  // sadece Onayla'nin tetikledigi ilk acilis kalici.
  toggleHedefGroup(): void {
    this.hedefExpanded.update((v) => !v);
  }

  private resetGraphState(): void {
    this.usedSourceSchemaIds.set([]);
    this.connections.set([]);
  }

  get selectedFileType(): FileType | undefined {
    return this.fileTypes().find((ft) => ft.id === this.selectedFileTypeId);
  }

  get selectedProduct(): Product | undefined {
    return this.products().find((p) => p.id === this.selectedProductId);
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
    if (this.usedSourceSchemaIds().length > 0) {
      this.canvasRevealed.set(true);
    }

    if (this.awaitingInitialGraphReady) {
      this.awaitingInitialGraphReady = false;
    } else {
      this.isDirty.set(true);
    }
  }

  toggleMappingsPanel(): void {
    this.showMappingsPanel.update((v) => !v);
  }

  // "Kayıtlı Mapping'ler" panelinden, o an bu ekranda acik olan mapping
  // silinirse - eskiden arka sayfa hicbir sey degismemis gibi ayni
  // (silinmis) mapping'i gostermeye devam ediyordu, kullanici ancak elle
  // sayfayi yenileyince (loadExistingMapping'in 404 kontrolu sayesinde)
  // fark ediyordu. Artik anlik olarak "yeni mapping" durumuna donup
  // haber veriyoruz.
  //
  // Ece'nin canli yakaladigi bir eksik: resetForNewMapping() SADECE ic
  // state'i sifirliyordu, URL'yi DEGISTIRMIYORDU - adres cubugu hala
  // /mapping/edit/{silinenId} gosterirmeye devam ediyordu (sayfa icerigi
  // "Yeni Mapping Olustur" desin bile). Kullanici daha sonra sayfayi
  // yenileyince, URL hala o gecersiz id'yi tasidigi icin loadExistingMapping
  // AYNI 404 akisini tekrar tetikliyordu - "yeni mapping" gordugu halde ayni
  // hatayla tekrar karsilasiyordu. router.navigate ile URL'yi de gercekten
  // /mapping'e tasiyoruz ki gorunen durumla adres cubugu tutarli olsun.
  onMappingDeleted(id: string): void {
    if (this.mappingId !== id) {
      return;
    }
    this.resetForNewMapping();
    this.showMappingsPanel.set(false);
    this.toastService.error('Düzenlemekte olduğunuz mapping silindi.');
    this.router.navigate(['/mapping']);
  }

  toggleSourceSchemaModal(): void {
    this.showSourceSchemaModal.update((v) => !v);
  }

  toggleSavePopup(): void {
    this.showSavePopup.update((v) => !v);
  }

  onMappingNameChanged(value: string): void {
    this.mappingName = value;
    this.isDirty.set(true);
  }

  onSchemaCreated(schema: SourceSchema): void {
    this.sourceSchemas.update((list) => [...list, schema]);
    this.resetSchemaSelect();
  }

  onSchemaDeleted(schemaId: string): void {
    this.sourceSchemas.update((list) => list.filter((s) => s.id !== schemaId));
  }

  // Bu select bilerek [(ngModel)] KULLANMIYOR: Angular'in SelectControlValueAccessor'i,
  // @for listesi buyuyunce (yeni sema eklendiginde/olusturulunca) option'lara verdigi
  // ic ID'leri kaydirip degeri yanlis resmediyordu (model dogru ama DOM eski degerde
  // takili kalıyordu). Bunun yerine select'i tamamen elle yonetiyoruz: (change)
  // event'inden deger okunuyor, sifirlanacagi zaman native elemanin .value'su elle
  // esitleniyor.
  onSourceSchemaSelectChange(selectEl: HTMLSelectElement): void {
    this.newSourceSchemaId = selectEl.value;
  }

  addSourceSchema(): void {
    if (!this.newSourceSchemaId || this.usedSourceSchemaIds().length > 0) {
      return;
    }
    const schema = this.sourceSchemas().find((s) => s.id === this.newSourceSchemaId);
    if (!schema) {
      return;
    }
    const index = this.usedSourceSchemaIds().length;
    this.canvas.addSourceSchema(schema, this.defaultSchemaX(index), this.defaultSchemaY(index));
    this.resetSchemaSelect();
  }

  private resetSchemaSelect(): void {
    this.newSourceSchemaId = '';
    if (this.schemaSelectRef) {
      this.schemaSelectRef.nativeElement.value = '';
    }
  }

  removeEdge(id: string): void {
    this.canvas.removeEdge(id);
  }

  // Kaynak semadaki ve hedef dosya tipindeki alan adlarini AI'ya gonderip
  // eslestirme onerisi istiyor - canvas'ta onerileri kesikli cizgi olarak
  // gosteriyor, kullanicinin her birini tek tek onaylamasi/reddetmesi gerekiyor
  // (bkz. proje karari: otomatik/sessiz baglanti kurulmuyor).
  suggestMatches(): void {
    const schemaId = this.usedSourceSchemaIds()[0];
    const schema = this.sourceSchemas().find((s) => s.id === schemaId);
    const targetFileType = this.activeFileType();

    if (!schema || !targetFileType) {
      return;
    }

    this.suggestingMatches.set(true);
    this.suggestError.set(null);

    const sourceFieldNames = schema.fields.map((f) => f.name);
    const targetFieldNames = targetFileType.targetFields.map((f) => f.name);

    this.fieldMatchSuggestionService.suggest(sourceFieldNames, targetFieldNames).subscribe({
      next: (suggestions) => {
        this.suggestingMatches.set(false);
        this.canvas.showSuggestions(suggestions);
        if (suggestions.length === 0) {
          this.toastService.error('AI herhangi bir eşleştirme önerisi bulamadı.');
        }
      },
      error: () => {
        this.suggestingMatches.set(false);
        this.suggestError.set('Eşleştirme önerisi alınamadı. API çalışıyor mu?');
      },
    });
  }

  saveMapping(): void {
    if (!this.mappingName.trim()) {
      this.toastService.error('Mapping adı zorunlu.');
      return;
    }

    const snapshot = this.canvas.getSnapshot();

    if (!snapshot.edges.some((e) => e.toKind === 'TargetField')) {
      this.toastService.error('En az bir hedef alan bağlantısı olmalı.');
      return;
    }

    if (snapshot.sourceSchemas.length !== 1) {
      this.toastService.error('Tam olarak bir kaynak şema seçilmelidir.');
      return;
    }

    this.saving.set(true);

    const request = {
      name: this.mappingName.trim(),
      sourceSchemas: snapshot.sourceSchemas.map((s) => ({
        sourceSchemaId: s.sourceSchemaId,
        alias: this.sourceSchemas().find((x) => x.id === s.sourceSchemaId)?.name ?? '',
        positionX: s.positionX,
        positionY: s.positionY,
      })),
      // selectedFileTypeId DEGIL: Hedef paneli tekrar acilip Onayla'ya
      // basilmadan farkli bir Dosya Tipi secilmis olabilir (dropdown'daki
      // secim gecici/commit-edilmemis). Canvas'in gercekten gosterdigi ve
      // baglantilarin ait oldugu hedef her zaman activeFileType.
      fileTypeId: this.activeFileType()?.id ?? '',
      functoidNodes: snapshot.functoidNodes,
      constantNodes: snapshot.constantNodes,
      edges: snapshot.edges,
    };

    const wasNew = !this.mappingId;
    const save$ = this.mappingId
      ? this.mappingService.update(this.mappingId, request)
      : this.mappingService.create(request);

    save$.subscribe({
      next: (mapping) => {
        this.saving.set(false);
        this.showSavePopup.set(false);
        this.isDirty.set(false);
        const edgeCount = mapping.edges.filter((e) => e.toKind === 'TargetField').length;
        this.toastService.success(`${wasNew ? 'Kaydedildi' : 'Güncellendi'}: ${mapping.name} (${edgeCount} hedef alan bağlantısı)`);
        // İlk kayıtta URL hâlâ /mapping'de kalıyordu (yeni mapping rotası) —
        // bu yüzden Önizleme'ye gidip geri dönmek ya da sayfayı yenilemek
        // her şeyi sıfırlıyordu. Kayıt sonrası /mapping/edit/:id'ye
        // yönlendirerek geri dönüşte aynı mapping'in yüklenmesini sağlıyoruz.
        if (wasNew) {
          this.router.navigate(['/mapping/edit', mapping.id]);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        // Guncelleme sirasinda 404 - mapping baska bir yerden (orn. "Kayitli
        // Mapping'ler" panelinden, baska bir sekmede) zaten silinmis demektir.
        // Genel "kaydedilemedi/API calisiyor mu?" mesaji yanlis yonlendirici
        // olurdu (loadExistingMapping'deki ayni duzeltmenin karsiligi).
        if (!wasNew && err.status === 404) {
          this.resetForNewMapping();
          this.toastService.error('Bu mapping artık mevcut değil (başka bir yerden silinmiş olabilir).');
          return;
        }
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Mapping kaydedilemedi. API çalışıyor mu?');
      },
    });
  }
}
