import { DatePipe } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MappingService } from '../../../core/services/mapping.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthService } from '../../../core/services/auth.service';
import { Mapping, MappingStatus } from '../../../core/models/mapping.model';
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
export class MappingList implements OnInit {
  private readonly mappingService = inject(MappingService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly authService = inject(AuthService);

  readonly mappings = signal<Mapping[]>([]);
  readonly error = signal<string | null>(null);
  readonly columns = ['name', 'fieldCount', 'status', 'updatedAt', 'actions'];

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

  @Output() readonly newMapping = new EventEmitter<void>();
  @Output() readonly mappingDeleted = new EventEmitter<string>();

  ngOnInit(): void {
    this.loadMappings();
  }

  loadMappings(): void {
    this.error.set(null);
    this.mappingService
      .getPage(this.pageIndex(), this.pageSize(), this.sort(), this.search(), this.statusFilter() || undefined)
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

  targetFieldEdgeCount(mapping: Mapping): number {
    return mapping.edges.filter((e) => e.toKind === 'TargetField').length;
  }

  // "Sil" butonu artik herkese gorunur (Ece'nin karari, 2026-08-19: yetkisi
  // olmayana gizlemek yerine tiklayinca uyarmak) - gercek kisitlama burada,
  // deleteMapping()'in basinda yapiliyor. Backend'de de ayni kisitlama var
  // (MappingsController).
  canManageMappings(): boolean {
    return this.authService.hasRole('Admin', 'MappingDefiner');
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
