import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
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
import { InstitutionService } from '../../../core/services/institution.service';
import { FunctoidService } from '../../../core/services/functoid.service';
import { FieldMatchSuggestionService } from '../../../core/services/field-match-suggestion.service';
import { FileType } from '../../../core/models/file-type.model';
import { FunctoidDefinition } from '../../../core/models/functoid.model';
import { Product } from '../../../core/models/product.model';
import { SourceSchema } from '../../../core/models/source-schema.model';
import { Institution } from '../../../core/models/institution.model';
import { MappingStatus } from '../../../core/models/mapping.model';
import { MappingCanvas, MappingCanvasSnapshot } from '../mapping-canvas/mapping-canvas';
import { MappingList } from '../mapping-list/mapping-list';
import { SourceSchemaList } from '../../source-schemas/source-schema-list/source-schema-list';
import { HasUnsavedChanges } from '../../../core/guards/unsaved-changes.guard';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthService } from '../../../core/services/auth.service';
import { PageAccessService } from '../../../core/services/page-access.service';

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
  private readonly institutionService = inject(InstitutionService);
  private readonly functoidService = inject(FunctoidService);
  private readonly fieldMatchSuggestionService = inject(FieldMatchSuggestionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly authService = inject(AuthService);
  private readonly pageAccessService = inject(PageAccessService);

  // mapping-list.ts'teki canManageMappings ile ayni gerekce/rol seti -
  // Viewer bu ekrana gelip goruntuleyebilsin ama Kaydet/Yeni Sema gibi
  // degistirici aksiyonlari yapamasin (backend zaten 403 donuyor, burasi
  // sadece kullanici deneyimini duzeltiyor). Butonlar artik (Ece'nin karari,
  // 2026-08-19) gizlenmiyor, gorunur kalip tiklaninca requireEditPermission
  // ile uyariyor.
  canEditMapping(): boolean {
    return this.authService.hasRole('Admin', 'MappingDefiner');
  }

  private requireEditPermission(): boolean {
    if (this.canEditMapping()) {
      return true;
    }
    this.toastService.error('Bu işlem için yetkiniz yok.');
    return false;
  }

  // dashboard.ts/mapping-list.ts'teki canApprove ile ayni gerekce/rol seti.
  canApprove(): boolean {
    return this.authService.hasRole('Admin', 'Approver');
  }

  mappingId: string | null = null;
  readonly loadingExisting = signal(false);

  // Onay Bekleyenler tablosundan gelindiginde (bkz. approval-queue.html'deki
  // routerLink [queryParams]="{fromApproval:1}") mapping'in kendi ekraninda
  // da Onayla/Reddet gorunsun diye - Ece'nin acik karari: bu SADECE bu
  // senaryo icin, mapping-editor'e genel bir onay bolumu eklenmiyor. Route
  // paramMap'teki mappingId gibi bu da paramMap subscription'i icinde
  // okunuyor (ngOnInit, asagida) - snapshot degil, cunku /mapping/edit/:id
  // -> /mapping/edit/:baska-id gecisinde Angular ayni component instance'ini
  // yeniden kullaniyor.
  readonly fromApproval = signal(false);
  readonly mappingStatus = signal<MappingStatus | null>(null);
  readonly showApprovalSection = computed(
    () => this.fromApproval() && this.mappingStatus() === 'PendingApproval' && this.canApprove()
  );
  readonly approving = signal(false);
  readonly showRejectPopup = signal(false);
  rejectReason = '';

  // Ece'nin karari (2026-08-22): reddedilme gerekcesi eskiden sadece Onaylar
  // ekraninda gorunuyordu, ama mapping'i tanimlayan (MappingDefiner) rolu o
  // ekrana erisemiyor. Bu banner - fromApproval'dan farkli olarak - HANGI
  // yoldan gelinirse gelinsin (dogrudan link, Kayitli Mapping'ler, arama)
  // her zaman gosteriliyor, cunku amac tanimlayanin BULMASI, ozel bir rota
  // degil.
  readonly rejectionReason = signal<string | null>(null);
  readonly showRejectionSection = computed(() => this.mappingStatus() === 'Rejected');

  // "/mapping" (bos canvas + Kayitli Mapping'ler paneli) Viewer/Approver'a da
  // acik - kayitli mapping listesine ulasabilmeleri gerekiyor, o yuzden bu
  // rota roleGuard tasimiyor (bkz. app.routes.ts). Ama bu ikisi yeni mapping
  // TANIMLAYAMIYOR (canEditMapping() sadece Admin/MappingDefiner), ve
  // eskiden buraya gelince formun neden hep devre disi oldugunu aciklayan
  // hicbir sey yoktu. Ece'nin istegi (2026-08-24): sayfaya her yeni-mapping
  // olarak (yani id'siz) girislerinde, yetkileri yoksa bunu aciklayan bir
  // uyari popup'i gostersin - bkz. paramMap subscription'i (asagida) ve
  // mapping-editor.html'deki create-permission-notice modali.
  readonly showCreatePermissionNotice = signal(false);

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
  readonly institutions = signal<Institution[]>([]);
  readonly functoidDefinitions = signal<FunctoidDefinition[]>([]);
  readonly error = signal<string | null>(null);

  readonly sourceSchemasLoaded = signal(false);
  readonly functoidDefinitionsLoaded = signal(false);
  private readonly rawPendingSnapshot = signal<MappingCanvasSnapshot | null>(null);
  readonly effectiveSnapshot = computed(() =>
    this.sourceSchemasLoaded() && this.functoidDefinitionsLoaded() ? this.rawPendingSnapshot() : null
  );

  readonly usedSourceSchemaIds = signal<string[]>([]);
  // Ece'nin karari (2026-08-19, Faz 3 Asama B): bir mapping'e birden fazla
  // Kurum etiketlenebilir - usedSourceSchemaIds ile ayni "secilenler listesi"
  // deseni, ama 1 ile sinirlanmiyor.
  readonly usedKurumIds = signal<string[]>([]);
  readonly connections = signal<{ id: string; from: string; to: string }[]>([]);
  // Canvas'ta bir baglanti cizgisine tiklaninca hangisi oldugunu Baglantilar
  // listesinde bulmak zordu (Ece'nin istegi, 2026-08-24) - mapping-canvas'in
  // yaydigi edgeSelected buraya baglaniyor, liste tarafinda ayni id'ye sahip
  // satir vurgulaniyor (bkz. mapping-editor.html .connection-list).
  readonly selectedConnectionId = signal<string | null>(null);
  readonly suggestingMatches = signal(false);
  readonly suggestError = signal<string | null>(null);
  // /mapping ve /mapping/edit/:id ayni component instance'ini paylastigi icin
  // (bkz. yukaridaki route.paramMap yorumu), bir mapping'de AI onerisi
  // istenirken (suggestMatches) baska bir mapping'e gecilirse eski cevap
  // gecikmeli gelip YENI mapping'in canvas'ina yanlis onerileri
  // ciziyordu - Ece'nin istegiyle yapilan kapsamli tarama sirasinda bulundu
  // (2026-08-24). Yeni bir mapping yuklenmeye baslarken bu abonelik iptal
  // ediliyor (bkz. loadExistingMapping/resetForNewMapping).
  private pendingSuggestionSub: Subscription | null = null;

  // Kaydet butonu, saveMapping()'in zaten reddedecegi bir durumu (hedef
  // yok/kaynak yok/hic baglanti yok) kullaniciya oncesinde gostermeden
  // acmasin diye - eskiden buton her zaman tiklanabiliyordu, hicbir sey
  // secilmemisken bile "Mapping Adi" popup'ini acip sonra "zorunlu" hatasi
  // veriyordu.
  // canEditMapping() de disabled kosuluna dahil (Ece'nin karari, 2026-08-22) -
  // eskiden bu buton, var olan bir mapping'de (hedef/kaynak/baglanti zaten
  // dolu oldugu icin) Viewer/Approver'a da tamamen tiklanabilir gorunuyordu,
  // ustteki Urun/Dosya Tipi dropdown'lari griyken - ayni panelde iki farkli
  // gorsel sinyal veriyordu. Davranis degismiyor (zaten tiklaninca
  // requireEditPermission() toast veriyordu), sadece erken/tutarli uyariyor.
  readonly canSave = computed(
    () =>
      this.hedefConfirmedOnce() &&
      this.usedSourceSchemaIds().length > 0 &&
      this.connections().length > 0 &&
      !this.saving() &&
      this.canEditMapping()
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
  newKurumId = '';

  mappingName = '';
  readonly saving = signal(false);

  // institution-list.ts/approval-queue.ts'teki ayni desen - /mapping/edit/:id
  // artik roleGuard tasiyor (bkz. app.routes.ts, Viewer haric), yetkisiz
  // erisimde veri cekmeyi hic denemiyoruz - yoksa yetkisiz modaliyla birlikte
  // yaniltici bir "API calisiyor mu?" hatasi da ustune biner. "/mapping" (bos
  // canvas) kisitlanmadi, bu yuzden oraya giren herkes icin bu erken-donus
  // hicbir zaman tetiklenmiyor.
  ngOnInit(): void {
    if (this.pageAccessService.denied()) {
      return;
    }

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

    this.institutionService.getAll().subscribe({
      next: (institutions) => this.institutions.set(institutions),
      error: () => {}, // sessiz gec - Kurum etiketleme ikincil bir bilgi, ana akisi engellememeli
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
        // Panel'deki "Tumunu gor" linki (?list=1) hem bu bildirimi hem de
        // asagidaki showMappingsPanel'i tetikleyebiliyordu - ikisi de ayni
        // "listeye eris" ihtiyacini karsiladigi icin ust uste iki modal
        // gostermek yerine, liste zaten acilacaksa bildirimi atliyoruz
        // (Ece'nin canli yakaladigi bug, 2026-08-24).
        const openingViaList = this.route.snapshot.queryParamMap.get('list') === '1';
        if (!this.canEditMapping() && !openingViaList) {
          this.showCreatePermissionNotice.set(true);
        }
      }
    });

    // route.paramMap ile ayni gerekce: snapshot degil subscribe, çünkü Onay
    // Bekleyenler'den bir mapping'e, oradan "Kayıtlı Mapping'ler" panelinden
    // baska (query param'siz) bir mapping'e gecilirse fromApproval eski
    // deger uzerinde takili kalmamali.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.fromApproval.set(params.get('fromApproval') === '1');
    });

    // Panel'deki "Tumunu gor" linki buraya ?list=1 ile geliyor - kullanici
    // "kayitli mapping'lerin tumunu" gormek istedigi icin bos "Yeni Mapping"
    // formu yerine dogrudan "Kayitli Mapping'ler" panelini acik karsilamali.
    if (this.route.snapshot.queryParamMap.get('list') === '1') {
      this.showMappingsPanel.set(true);
    }
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
    this.showCreatePermissionNotice.set(false);
    this.cancelPendingSuggestion();
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
    this.usedKurumIds.set([]);
    this.mappingStatus.set(null);
    this.rejectionReason.set(null);
    this.awaitingInitialGraphReady = false;
    this.isDirty.set(false);
  }

  private loadExistingMapping(id: string): void {
    this.loadingExisting.set(true);

    // resetForNewMapping()'in id-yok durumu icin yaptigi temizligin bir
    // benzeri burada da gerekli - /mapping ve /mapping/edit/:id ayni
    // component instance'ini paylastigi icin (bkz. yukaridaki paramMap
    // yorumu), onceki mapping'den kalma bir popup/hata/AI-oneri istegi
    // yeni yuklenen mapping'in UZERINDE acik/gecerli kalabiliyordu. En ciddisi:
    // showRejectPopup+rejectReason temizlenmezse, biri bir mapping'i reddetmek
    // icin popup'i acik birakip "Kayitli Mapping'ler"den BASKA bir mapping'e
    // gecerse, confirmRejectFromEditor() artik guncellenmis this.mappingId ile
    // YANLIS mapping'i (eski reddetme metniyle) reddedebiliyordu - Ece'nin
    // istegiyle yapilan kapsamli taramada bulundu (2026-08-24).
    this.showCreatePermissionNotice.set(false);
    this.showRejectPopup.set(false);
    this.rejectReason = '';
    this.showSourceSchemaModal.set(false);
    this.showSavePopup.set(false);
    this.approving.set(false);
    this.error.set(null);
    this.cancelPendingSuggestion();

    this.mappingService.getById(id).subscribe({
      next: (mapping) => {
        this.mappingName = mapping.name;
        this.usedKurumIds.set(mapping.kurumIds);
        this.mappingStatus.set(mapping.status);
        this.rejectionReason.set(mapping.rejectionReason);

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
    if (!this.requireEditPermission()) return;

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
      // isFirstConfirm'de canvas henuz DOM'da yok (hedefConfirmedOnce bu
      // cagrinin sonunda ilk kez true oluyor) - o yuzden sadece canvas'in
      // ONCEDEN VAR oldugu (ikinci ve sonraki hedef degisiklikleri) durumda
      // gercek X6 node'larini da temizliyoruz. Eskiden sadece yukaridaki
      // resetGraphState() (MappingEditor'un KENDI usedSourceSchemaIds/
      // connections sinyalleri) calisiyordu, canvas'taki gercek kaynak sema/
      // functoid node'lari yerinde kalip yeni hedefe "yetim" asili
      // kaliyordu - Ece'nin istegiyle yapilan kapsamli taramada bulundu
      // (2026-08-24, bkz. [[project_known_minor_issues]] madde 5).
      if (!isFirstConfirm) {
        this.canvas.clearSourceContent();
      }
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
    this.selectedConnectionId.set(null);
  }

  private cancelPendingSuggestion(): void {
    this.pendingSuggestionSub?.unsubscribe();
    this.pendingSuggestionSub = null;
    this.suggestingMatches.set(false);
    this.suggestError.set(null);
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

  get availableKurumsToAdd(): Institution[] {
    const used = new Set(this.usedKurumIds());
    return this.institutions().filter((k) => !used.has(k.id));
  }

  kurumName(id: string): string {
    return this.institutions().find((k) => k.id === id)?.name ?? '—';
  }

  addKurum(): void {
    if (!this.requireEditPermission()) return;
    if (!this.newKurumId) return;

    this.usedKurumIds.update((ids) => [...ids, this.newKurumId]);
    this.newKurumId = '';
    this.isDirty.set(true);
  }

  removeKurum(id: string): void {
    if (!this.requireEditPermission()) return;

    this.usedKurumIds.update((ids) => ids.filter((k) => k !== id));
    this.isDirty.set(true);
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

  // mapping-list.ts'teki mappingOpened output'unun karsiligi - Approver/Admin
  // "Kayıtlı Mapping'ler" panelinden Düzenle'ye basinca oraya gecerken panel
  // acik kalip yeni mapping'in arkasinda goruniyordu (Ece'nin canli
  // yakaladigi bug, 2026-08-24) - startNewMapping()'teki ayni ilk-satir
  // deseniyle tutarli.
  onMappingOpened(): void {
    this.showMappingsPanel.set(false);
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

  // "+ Yeni Şema" butonunun kendi tetikleyicisi - toggleSourceSchemaModal()
  // modali kapatmak icin de kullanildigi icin (bkz. modal-backdrop/X butonu)
  // yetki kontrolunu direkt oraya koymak kapatmayi da engellerdi.
  onNewSchemaClick(): void {
    if (!this.requireEditPermission()) return;
    this.toggleSourceSchemaModal();
  }

  toggleSavePopup(): void {
    this.showSavePopup.update((v) => !v);
  }

  // Kaydet butonunun kendi tetikleyicisi - toggleSavePopup() ile ayni
  // gerekce (bkz. onNewSchemaClick).
  onSaveClick(): void {
    if (!this.requireEditPermission()) return;
    this.toggleSavePopup();
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
    if (!this.requireEditPermission()) return;
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
    if (!this.requireEditPermission()) return;
    this.canvas.removeEdge(id);
  }

  onEdgeSelected(id: string | null): void {
    this.selectedConnectionId.set(id);
  }

  dismissCreatePermissionNotice(): void {
    this.showCreatePermissionNotice.set(false);
  }

  // Kaynak semadaki ve hedef dosya tipindeki alan adlarini AI'ya gonderip
  // eslestirme onerisi istiyor - canvas'ta onerileri kesikli cizgi olarak
  // gosteriyor, kullanicinin her birini tek tek onaylamasi/reddetmesi gerekiyor
  // (bkz. proje karari: otomatik/sessiz baglanti kurulmuyor).
  suggestMatches(): void {
    if (!this.requireEditPermission()) return;

    const schemaId = this.usedSourceSchemaIds()[0];
    const schema = this.sourceSchemas().find((s) => s.id === schemaId);
    const targetFileType = this.activeFileType();

    if (!schema || !targetFileType) {
      return;
    }

    this.pendingSuggestionSub?.unsubscribe();
    this.suggestingMatches.set(true);
    this.suggestError.set(null);

    const sourceFieldNames = schema.fields.map((f) => f.name);
    const targetFields = targetFileType.targetFields.map((f) => ({ name: f.name, length: f.length }));

    this.pendingSuggestionSub = this.fieldMatchSuggestionService.suggest(sourceFieldNames, targetFields).subscribe({
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
    if (!this.requireEditPermission()) return;
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
      kurumIds: this.usedKurumIds(),
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

  // approval-queue.ts'teki approveMapping/openRejectPopup/confirmReject ile
  // ayni backend cagrilari (MappingService.approve/reject) - buradaki tek
  // fark, karardan sonra kullaniciyi Onay Bekleyenler listesine geri
  // yonlendirmemiz: bu ekrana zaten o listeden gelindi, karar verildikten
  // sonra mapping burada goruntulenmeye devam etmeyecek (showApprovalSection
  // zaten mappingStatus PendingApproval degilse kapanir).
  approveMappingFromEditor(): void {
    if (!this.mappingId) return;
    this.approving.set(true);
    this.mappingService.approve(this.mappingId).subscribe({
      next: (mapping) => {
        this.approving.set(false);
        this.toastService.success(`Onaylandı: ${mapping.name}`);
        this.router.navigate(['/approvals']);
      },
      error: (err: HttpErrorResponse) => {
        this.approving.set(false);
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Mapping onaylanamadı. API çalışıyor mu?');
      },
    });
  }

  openRejectPopup(): void {
    this.rejectReason = '';
    this.showRejectPopup.set(true);
  }

  closeRejectPopup(): void {
    this.showRejectPopup.set(false);
  }

  confirmRejectFromEditor(): void {
    if (!this.mappingId || !this.rejectReason.trim()) return;

    this.mappingService.reject(this.mappingId, this.rejectReason.trim()).subscribe({
      next: (mapping) => {
        this.showRejectPopup.set(false);
        this.toastService.success(`Reddedildi: ${mapping.name}`);
        this.router.navigate(['/approvals']);
      },
      error: (err: HttpErrorResponse) => {
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Mapping reddedilemedi. API çalışıyor mu?');
      },
    });
  }
}
