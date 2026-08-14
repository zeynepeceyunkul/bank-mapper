import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RunHistoryService } from '../../../core/services/run-history.service';
import { MappingRun, RunKind } from '../../../core/models/run-history.model';

type SuccessFilter = '' | 'true' | 'false';

@Component({
  selector: 'app-run-history-list',
  imports: [DatePipe, RouterLink, MatPaginatorModule],
  templateUrl: './run-history-list.html',
  styleUrl: './run-history-list.scss',
})
export class RunHistoryList implements OnInit {
  private readonly runHistoryService = inject(RunHistoryService);

  readonly runs = signal<MappingRun[]>([]);
  readonly error = signal<string | null>(null);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly totalCount = signal(0);
  readonly pageSizeOptions = [5, 10, 25, 50];

  readonly kindFilter = signal<RunKind | ''>('');
  readonly successFilter = signal<SuccessFilter>('');

  ngOnInit(): void {
    this.loadRuns();
  }

  loadRuns(): void {
    this.error.set(null);
    const kind = this.kindFilter() || undefined;
    const success = this.successFilter() === '' ? undefined : this.successFilter() === 'true';

    this.runHistoryService.getPage(this.pageIndex(), this.pageSize(), kind, success).subscribe({
      next: (result) => {
        this.runs.set(result.items);
        this.totalCount.set(result.totalCount);
      },
      error: () => this.error.set('Çalıştırma geçmişi yüklenemedi. API çalışıyor mu?'),
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
}
