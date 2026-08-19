import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RunHistoryService } from '../../../core/services/run-history.service';
import { MappingRun, RunKind } from '../../../core/models/run-history.model';

type SuccessFilter = '' | 'true' | 'false';

@Component({
  selector: 'app-run-history-list',
  imports: [DatePipe, RouterLink, MatPaginatorModule, MatProgressSpinnerModule],
  templateUrl: './run-history-list.html',
  styleUrl: './run-history-list.scss',
})
export class RunHistoryList implements OnInit, OnDestroy {
  private readonly runHistoryService = inject(RunHistoryService);

  readonly runs = signal<MappingRun[]>([]);
  readonly error = signal<string | null>(null);

  // Sadece ilk yukleme icin - mapping-list.ts'teki ayni desen (bkz. oradaki
  // yorum).
  readonly loading = signal(true);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly totalCount = signal(0);
  readonly pageSizeOptions = [5, 10, 25, 50];

  readonly kindFilter = signal<RunKind | ''>('');
  readonly successFilter = signal<SuccessFilter>('');

  readonly detailTooltip = signal<{ text: string; left: number; top: number | null; bottom: number | null } | null>(
    null,
  );

  // preview-execute.ts'teki ayni desen: scroll sirasinda balon eski
  // konumunda asili kalip satirdan kopmus gibi durmasin diye kapatiyoruz.
  private readonly onScroll = () => this.hideDetailTooltip();

  ngOnInit(): void {
    this.loadRuns();
    window.addEventListener('scroll', this.onScroll, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll, true);
  }

  loadRuns(): void {
    this.error.set(null);
    const kind = this.kindFilter() || undefined;
    const success = this.successFilter() === '' ? undefined : this.successFilter() === 'true';

    this.runHistoryService.getPage(this.pageIndex(), this.pageSize(), kind, success).subscribe({
      next: (result) => {
        this.runs.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Çalıştırma geçmişi yüklenemedi. API çalışıyor mu?');
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadRuns();
  }

  onKindFilterChange(value: RunKind | ''): void {
    this.kindFilter.set(value);
    this.pageIndex.set(0);
    this.loadRuns();
  }

  onSuccessFilterChange(value: SuccessFilter): void {
    this.successFilter.set(value);
    this.pageIndex.set(0);
    this.loadRuns();
  }

  detailText(run: MappingRun): string {
    return run.success ? `${run.rowCount} satır üretildi` : (run.errorMessage ?? '');
  }

  // Native title tooltip'i yerine kendi baloncugumuz - preview-execute.ts'teki
  // ayni mantik (bkz. oradaki yorum): position:fixed, satir ekranin altina
  // yakinsa balonu yukari acar. Metin zaten tek satira sigiyorsa (basarili
  // calistirmalardaki kisa "N satır üretildi" gibi) balon hic gosterilmiyor.
  showDetailTooltip(event: MouseEvent, text: string): void {
    const el = event.currentTarget as HTMLElement;
    if (el.scrollWidth <= el.clientWidth) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const tooltipWidth = 360;
    const margin = 6;

    const showAbove = window.innerHeight - rect.bottom < 120;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - tooltipWidth - 16));

    this.detailTooltip.set({
      text,
      left,
      top: showAbove ? null : rect.bottom + margin,
      bottom: showAbove ? window.innerHeight - rect.top + margin : null,
    });
  }

  hideDetailTooltip(): void {
    this.detailTooltip.set(null);
  }
}
