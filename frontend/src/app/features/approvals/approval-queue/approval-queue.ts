import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MappingService } from '../../../core/services/mapping.service';
import { ToastService } from '../../../core/services/toast.service';
import { Mapping, MappingStatus } from '../../../core/models/mapping.model';

@Component({
  selector: 'app-approval-queue',
  imports: [DatePipe, RouterLink, FormsModule, MatIconModule, MatButtonModule, MatPaginatorModule, MatProgressSpinnerModule],
  templateUrl: './approval-queue.html',
  styleUrl: './approval-queue.scss',
})
export class ApprovalQueue implements OnInit, OnDestroy {
  private readonly mappingService = inject(MappingService);
  private readonly toastService = inject(ToastService);

  // Ece'nin karari (2026-08-19): tek bir kuyruk yerine uc sekme - Bekleyenler
  // (varsayilan, aksiyon alinabilir), Onaylanan, Reddedilen (ikisi de salt
  // okunur karar kaydi). Ayri bir backend endpoint'i gerekmiyor, zaten var
  // olan tek-durum filtresi (getPage(status)) uc sekmede de kullaniliyor.
  readonly activeTab = signal<MappingStatus>('PendingApproval');

  readonly mappings = signal<Mapping[]>([]);
  readonly error = signal<string | null>(null);

  // mapping-list.ts'teki ayni desen - sadece ilk yukleme icin, sonraki
  // sayfalama/onayla/reddet sonrasi yeniden yuklemede tekrar true'ya donmuyor.
  readonly loading = signal(true);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly totalCount = signal(0);
  readonly pageSizeOptions = [5, 10, 25, 50];

  // Reddetme burada da mapping-list.ts ile ayni sekilde bir gerekce metni
  // gerektiriyor, ayni kucuk modal deseni tekrar kullanildi.
  readonly rejectTarget = signal<Mapping | null>(null);
  rejectReason = '';

  // run-history-list.ts'teki .detail-cell tooltip'iyle ayni desen - Red
  // Gerekçesi sütunu da sabit genişlikte tek satıra kesiliyor, uzun bir
  // gerekçe metni için aynı hover balonu tekrar kullanıldı.
  readonly reasonTooltip = signal<{ text: string; left: number; top: number | null; bottom: number | null } | null>(
    null,
  );
  private readonly onScroll = () => this.hideReasonTooltip();

  ngOnInit(): void {
    this.loadMappings();
    window.addEventListener('scroll', this.onScroll, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll, true);
  }

  setTab(tab: MappingStatus): void {
    if (this.activeTab() === tab) {
      return;
    }
    this.activeTab.set(tab);
    this.pageIndex.set(0);
    this.loadMappings();
  }

  loadMappings(): void {
    this.error.set(null);
    this.mappingService.getPage(this.pageIndex(), this.pageSize(), 'RecentFirst', '', this.activeTab()).subscribe({
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

  approveMapping(mapping: Mapping): void {
    this.mappingService.approve(mapping.id).subscribe({
      next: () => {
        // Onaylanan satir bu ekranda artik "PendingApproval" olmadigi icin
        // listeden dusuyor - tek kayitsa ve ilk sayfada degilsek bir onceki
        // sayfaya donuyoruz (mapping-list.ts'teki silme sonrasi ayni desen).
        if (this.mappings().length === 1 && this.pageIndex() > 0) {
          this.pageIndex.update((i) => i - 1);
        }
        this.loadMappings();
        this.toastService.success(`Onaylandı: ${mapping.name}`);
      },
      error: (err) => {
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Mapping onaylanamadı. API çalışıyor mu?');
      },
    });
  }

  openRejectPopup(mapping: Mapping): void {
    this.rejectReason = '';
    this.rejectTarget.set(mapping);
  }

  closeRejectPopup(): void {
    this.rejectTarget.set(null);
  }

  confirmReject(): void {
    const mapping = this.rejectTarget();
    if (!mapping || !this.rejectReason.trim()) {
      return;
    }

    this.mappingService.reject(mapping.id, this.rejectReason.trim()).subscribe({
      next: () => {
        if (this.mappings().length === 1 && this.pageIndex() > 0) {
          this.pageIndex.update((i) => i - 1);
        }
        this.loadMappings();
        this.toastService.success(`Reddedildi: ${mapping.name}`);
        this.rejectTarget.set(null);
      },
      error: (err) => {
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Mapping reddedilemedi. API çalışıyor mu?');
      },
    });
  }

  // run-history-list.ts'teki showDetailTooltip ile ayni mantık: metin zaten
  // tek satıra sığıyorsa (kısa bir gerekçeyse) balon hiç gösterilmiyor.
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
}
