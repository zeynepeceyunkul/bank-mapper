import { DatePipe } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MappingService } from '../../../core/services/mapping.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthService } from '../../../core/services/auth.service';
import { InstitutionService } from '../../../core/services/institution.service';
import { Mapping, MappingStatus } from '../../../core/models/mapping.model';
import { Institution } from '../../../core/models/institution.model';
import { SortOption } from '../../../core/models/paged-result.model';

@Component({
  selector: 'app-mapping-list',
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './mapping-list.html',
  styleUrl: './mapping-list.scss',
})
export class MappingList implements OnInit, OnDestroy {
  private readonly mappingService = inject(MappingService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly authService = inject(AuthService);
  private readonly institutionService = inject(InstitutionService);
  private readonly router = inject(Router);

  readonly mappings = signal<Mapping[]>([]);
  readonly institutions = signal<Institution[]>([]);
  readonly error = signal<string | null>(null);
  readonly columns = ['name', 'kurum', 'fieldCount', 'status', 'updatedAt', 'actions'];

  // Sadece ilk yukleme icin - sayfalama/arama/silme sonrasi yeniden
  // yuklemede tekrar true'ya donmuyor (bkz. loadMappings), tablo her
  // seferinde spinner'a gecip gorunumu bozmasin.
  readonly loading = signal(true);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly totalCount = signal(0);
  readonly pageSizeOptions = [5, 10, 25, 50];
  readonly sort = signal<SortOption>('RecentFirst');
  readonly search = signal('');
  private searchDebounceHandle?: ReturnType<typeof setTimeout>;

  // "Onayımı Bekleyenler" filtresi - bos ise tum durumlar listelenir.
  readonly statusFilter = signal<MappingStatus | ''>('');

  // Ece'nin karari (2026-08-22): bir mapping reddedildiginde gerekce sadece
  // Onaylar ekraninda gorunuyordu, ama mapping'i tanimlayan (MappingDefiner)
  // rolu o ekrana erisemiyor. Bu filtre + Reddedildi rozetindeki tooltip
  // (asagida), tanimlayan kisinin "Duruma göre filtrele: Reddedildi" ile
  // birlikte kullanarak KENDI reddedilen mapping'lerini (birden fazla olsa
  // bile) Onaylar'a hic girmeden bulabilmesini sagliyor.
  readonly onlyMine = signal(false);

  // approval-queue.ts'teki reasonTooltip ile ayni desen: red gerekcesi tek
  // satira sigmiyorsa satirin kendisini genisletmek/coklu satira sarmak
  // yerine (eskiden .rejection-reason'da white-space:normal ile boyleydi -
  // Ece'nin fark ettigi gibi tabloyu bozuyordu), tek satira kesilip hover'da
  // bu balonla tam metin gosteriliyor.
  readonly reasonTooltip = signal<{ text: string; left: number; top: number | null; bottom: number | null } | null>(
    null,
  );
  private readonly onScroll = () => this.hideReasonTooltip();

  @Output() readonly newMapping = new EventEmitter<void>();
  @Output() readonly mappingDeleted = new EventEmitter<string>();
  // mapping-editor.html'de bu liste "Kayıtlı Mapping'ler" modalı icinde
  // gosteriliyor - openMapping()'in router.navigate'i /mapping/edit/:id'ye
  // gecerken MappingEditor component instance'i (ampirik olarak dogrulanmis
  // sekilde, bkz. mapping-editor.ts'teki route.paramMap yorumlari) YENIDEN
  // KULLANILIYOR, yok edilip yeniden yaratilmiyor - yani showMappingsPanel
  // sinyali eski (true) degerinde kalip modal acik kaliyordu, altinda yeni
  // mapping yuklenirken. startNewMapping() (newMapping output'unun karsiligi)
  // zaten kendi ilk satirinda showMappingsPanel.set(false) yapiyordu - ayni
  // gerekce/desen burada da uygulaniyor.
  @Output() readonly mappingOpened = new EventEmitter<void>();

  ngOnInit(): void {
    this.loadMappings();

    this.institutionService.getAll().subscribe({
      next: (institutions) => this.institutions.set(institutions),
      error: () => {}, // sessiz gec - preview-execute.ts'teki ayni desen, Kurum sutunu ikincil bir bilgi
    });

    window.addEventListener('scroll', this.onScroll, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll, true);
  }

  // approval-queue.ts'teki showReasonTooltip ile ayni mantik: metin zaten
  // tek satira sigiyorsa (kisa bir gerekceyse) balon hic gosterilmiyor.
  showReasonTooltip(event: MouseEvent, text: string): void {
    const el = event.currentTarget as HTMLElement;
    if (el.scrollWidth <= el.clientWidth) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const tooltipWidth = 360;
    const margin = 6;

    const showAbove = window.innerHeight - rect.bottom < 120;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - tooltipWidth - 16));

    this.reasonTooltip.set({
      text,
      left,
      top: showAbove ? null : rect.bottom + margin,
      bottom: showAbove ? window.innerHeight - rect.top + margin : null,
    });
  }

  hideReasonTooltip(): void {
    this.reasonTooltip.set(null);
  }

  loadMappings(): void {
    this.error.set(null);
    const createdBy = this.onlyMine() ? this.authService.email() ?? undefined : undefined;
    this.mappingService
      .getPage(this.pageIndex(), this.pageSize(), this.sort(), this.search(), this.statusFilter() || undefined, createdBy)
      .subscribe({
        next: (result) => {
          this.mappings.set(result.items);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Mapping listesi yüklenemedi. API çalışıyor mu?');
          this.loading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadMappings();
  }

  onSortChange(value: SortOption): void {
    this.sort.set(value);
    this.pageIndex.set(0);
    this.loadMappings();
  }

  // Her tus vuruşunda istek atmamak icin kisa bir debounce - kullanici
  // yazmayi biraktiktan 300ms sonra gerçek sorgu gidiyor.
  onSearchChange(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounceHandle);
    this.searchDebounceHandle = setTimeout(() => {
      this.pageIndex.set(0);
      this.loadMappings();
    }, 300);
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as MappingStatus | '');
    this.pageIndex.set(0);
    this.loadMappings();
  }

  onOnlyMineChange(value: boolean): void {
    this.onlyMine.set(value);
    this.pageIndex.set(0);
    this.loadMappings();
  }

  targetFieldEdgeCount(mapping: Mapping): number {
    return mapping.edges.filter((e) => e.toKind === 'TargetField').length;
  }

  kurumNames(mapping: Mapping): string {
    if (mapping.kurumIds.length === 0) return '—';
    const names = this.institutions();
    return mapping.kurumIds.map((id) => names.find((k) => k.id === id)?.name ?? '—').join(', ');
  }

  // "Sil" butonu artik herkese gorunur (Ece'nin karari, 2026-08-19: yetkisi
  // olmayana gizlemek yerine tiklayinca uyarmak) - gercek kisitlama burada,
  // deleteMapping()'in basinda yapiliyor. Backend'de de ayni kisitlama var
  // (MappingsController).
  canManageMappings(): boolean {
    return this.authService.hasRole('SuperAdmin', 'MappingDefiner');
  }

  // /mapping/edit/:id'ye giris yapabilecek rol seti (app.routes.ts'teki ayni
  // set) - Ece'nin karari (2026-08-22): "Duzenle" Sil ile ayni satirda,
  // aksiyon yetkisi yoksa da AYNI davranisi (sayfadan ayrilmadan toast)
  // gostermeli. Onceden routerLink dogrudan /mapping/edit/:id'ye gidip
  // roleGuard'in actigi tam sayfa modaline birakiyordu - ayni satirdaki Sil
  // butonuyla tutarsizdi (biri toast, digeri sayfa degisip modal).
  canOpenMapping(): boolean {
    return this.authService.hasRole('SuperAdmin', 'MappingDefiner', 'Approver');
  }

  openMapping(mapping: Mapping): void {
    if (!this.canOpenMapping()) {
      this.toastService.error('Bu mapping\'i görüntüleme yetkiniz yok.');
      return;
    }
    this.mappingOpened.emit();
    this.router.navigate(['/mapping/edit', mapping.id]);
  }

  statusLabel(status: MappingStatus): string {
    switch (status) {
      case 'Approved':
        return 'Onaylandı';
      case 'Rejected':
        return 'Reddedildi';
      default:
        return 'Onay Bekliyor';
    }
  }

  async deleteMapping(mapping: Mapping): Promise<void> {
    if (!this.canManageMappings()) {
      this.toastService.error('Bu işlem için yetkiniz yok.');
      return;
    }

    const confirmed = await this.confirmService.confirm(`'${mapping.name}' mapping'ini silmek istediğinize emin misiniz?`);
    if (!confirmed) return;

    this.mappingService.delete(mapping.id).subscribe({
      next: () => {
        // Server-side pagination'da yerel filtreleme yerine sayfayi yeniden
        // yukluyoruz (bkz. source-schema-list.ts'teki ayni desen) - silinen
        // kayit o sayfadaki tek kayitsa ve ilk sayfada degilsek bir onceki
        // sayfaya donuyoruz.
        if (this.mappings().length === 1 && this.pageIndex() > 0) {
          this.pageIndex.update((i) => i - 1);
        }
        this.loadMappings();
        this.toastService.success(`Silindi: ${mapping.name}`);
        this.mappingDeleted.emit(mapping.id);
      },
      error: (err) => {
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Mapping silinemedi. API çalışıyor mu?');
      },
    });
  }
}
