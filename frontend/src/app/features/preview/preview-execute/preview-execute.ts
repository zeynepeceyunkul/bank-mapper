import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MappingService } from '../../../core/services/mapping.service';
import { ConvertFileFormat, PreviewService, PreviewSourceFileUpload } from '../../../core/services/preview.service';
import { RunHistoryService } from '../../../core/services/run-history.service';
import { Mapping } from '../../../core/models/mapping.model';
import { MappingRun } from '../../../core/models/run-history.model';

const RECENT_RUNS_PAGE_SIZE = 5;

@Component({
  selector: 'app-preview-execute',
  imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatTableModule],
  templateUrl: './preview-execute.html',
  styleUrl: './preview-execute.scss',
})
export class PreviewExecute implements OnInit {
  private readonly mappingService = inject(MappingService);
  private readonly previewService = inject(PreviewService);
  private readonly runHistoryService = inject(RunHistoryService);

  readonly mappings = signal<Mapping[]>([]);
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly downloading = signal(false);
  readonly recentRuns = signal<MappingRun[]>([]);

  selectedMappingId = '';
  selectedFiles: Record<string, File | null> = {};
  selectedFormat: ConvertFileFormat = 'Csv';

  ngOnInit(): void {
    this.mappingService.getAll().subscribe({
      next: (mappings) => this.mappings.set(mappings),
      error: () => this.error.set('Mapping listesi yüklenemedi. API çalışıyor mu?'),
    });

    this.loadRecentRuns();
  }

  // Onizleme/Donusturme butonlarindan biri kullanildiktan hemen sonra da
  // cagriliyor - "az once ne oldu" sorusuna sayfa degistirmeden cevap versin
  // diye, tam gecmis (/run-history) sayfasina gitmeye gerek kalmadan.
  private loadRecentRuns(): void {
    this.runHistoryService.getPage(0, RECENT_RUNS_PAGE_SIZE).subscribe({
      next: (result) => this.recentRuns.set(result.items),
      error: () => {}, // sessiz gec - bu ana islevi (onizleme/donusturme) engellememeli
    });
  }

  // "Son Çalıştırmalar" burada goreli zaman kullanıyor (az önce/N dk önce) -
  // tam gecmis (/run-history) sayfası bunun aksine mutlak tarih gösteriyor,
  // orası bir denetim kaydı, burası anlık bir ozet.
  relativeTime(dateIso: string): string {
    const diffMs = Date.now() - new Date(dateIso).getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMin < 1) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} sa önce`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} gün önce`;
  }

  get selectedMapping(): Mapping | undefined {
    return this.mappings().find((m) => m.id === this.selectedMappingId);
  }

  onMappingChange(): void {
    this.selectedFiles = {};
    this.rows.set([]);
    this.warnings.set([]);
    this.error.set(null);
  }

  onFileSelected(schemaId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFiles = { ...this.selectedFiles, [schemaId]: input.files?.[0] ?? null };
  }

  fileName(schemaId: string): string {
    return this.selectedFiles[schemaId]?.name ?? 'Dosya seçilmedi';
  }

  get columns(): string[] {
    const first = this.rows()[0];
    return first ? Object.keys(first) : [];
  }

  private buildFileUploads(): PreviewSourceFileUpload[] | null {
    const mapping = this.selectedMapping;
    if (!mapping) {
      this.error.set('Bir mapping seçmelisin.');
      return null;
    }

    const uploads: PreviewSourceFileUpload[] = [];
    for (const ref of mapping.sourceSchemas) {
      const file = this.selectedFiles[ref.sourceSchemaId];
      if (!file) {
        this.error.set(`'${ref.alias}' için bir dosya seçmelisin.`);
        return null;
      }
      uploads.push({ schemaId: ref.sourceSchemaId, file });
    }
    return uploads;
  }

  runPreview(): void {
    this.error.set(null);
    this.rows.set([]);
    this.warnings.set([]);

    const uploads = this.buildFileUploads();
    if (!uploads) {
      return;
    }

    this.loading.set(true);

    this.previewService.execute(this.selectedMappingId, uploads).subscribe({
      next: (result) => {
        this.rows.set(result.rows);
        this.warnings.set(result.warnings);
        this.loading.set(false);
        this.loadRecentRuns();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(typeof err.error === 'string' ? err.error : 'Önizleme başarısız. API çalışıyor mu?');
        this.loading.set(false);
        this.loadRecentRuns();
      },
    });
  }

  private static readonly FORMAT_EXTENSIONS: Record<ConvertFileFormat, string> = {
    Csv: 'csv',
    Excel: 'xlsx',
  };

  downloadFile(): void {
    this.error.set(null);

    const uploads = this.buildFileUploads();
    if (!uploads) {
      return;
    }

    this.downloading.set(true);

    this.previewService.convert(this.selectedMappingId, uploads, this.selectedFormat).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `donusturulen-dosya.${PreviewExecute.FORMAT_EXTENSIONS[this.selectedFormat]}`;
        link.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
        this.loadRecentRuns();
      },
      error: (err: HttpErrorResponse) => {
        this.downloading.set(false);
        this.loadRecentRuns();
        if (err.error instanceof Blob) {
          err.error.text().then((message) => this.error.set(message || 'Dönüştürme başarısız.'));
        } else {
          this.error.set('Dönüştürme başarısız. API çalışıyor mu?');
        }
      },
    });
  }
}
