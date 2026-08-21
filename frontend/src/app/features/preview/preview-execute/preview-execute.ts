import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MappingService } from '../../../core/services/mapping.service';
import { InstitutionService } from '../../../core/services/institution.service';
import { ConvertFileFormat, PreviewService, PreviewSourceFileUpload } from '../../../core/services/preview.service';
import { RunHistoryService } from '../../../core/services/run-history.service';
import { Mapping } from '../../../core/models/mapping.model';
import { Institution } from '../../../core/models/institution.model';
import { MappingRun } from '../../../core/models/run-history.model';
import { relativeTime as formatRelativeTime } from '../../../core/utils/relative-time';

const RECENT_RUNS_PAGE_SIZE = 5;

@Component({
  selector: 'app-preview-execute',
  imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatTableModule],
  templateUrl: './preview-execute.html',
  styleUrl: './preview-execute.scss',
})
export class PreviewExecute implements OnInit, OnDestroy {
  private readonly mappingService = inject(MappingService);
  private readonly institutionService = inject(InstitutionService);
  private readonly previewService = inject(PreviewService);
  private readonly runHistoryService = inject(RunHistoryService);

  readonly mappings = signal<Mapping[]>([]);
  readonly institutions = signal<Institution[]>([]);
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly downloading = signal(false);
  readonly recentRuns = signal<MappingRun[]>([]);
  readonly errorTooltip = signal<{ text: string; left: number; top: number | null; bottom: number | null } | null>(
    null,
  );

  selectedMappingId = '';
  selectedKurumId = '';
  selectedFiles: Record<string, File | null> = {};
  selectedFormat: ConvertFileFormat = 'Csv';

  // Sayfa scroll edilirken (veya ic kapsayicida scroll varsa) balon eski
  // konumunda "asili" kalip satirdan kopmus gibi durmasin diye kapatiyoruz -
  // capture:true nested scroll container'lari da yakalasin diye.
  private readonly onScroll = () => this.hideErrorTooltip();

  ngOnInit(): void {
    this.loadMappings();

    this.institutionService.getAll().subscribe({
      next: (institutions) => this.institutions.set(institutions),
      error: () => {}, // sessiz gec - filtre ikincil bir bilgi, ana akisi engellememeli
    });

    this.loadRecentRuns();
    window.addEventListener('scroll', this.onScroll, true);
  }

  private loadMappings(): void {
    this.mappingService.getAll('Approved', this.selectedKurumId || undefined).subscribe({
      next: (mappings) => this.mappings.set(mappings),
      error: () => this.error.set('Mapping listesi yüklenemedi. API çalışıyor mu?'),
    });
  }

  // Kurum filtresi degisince secili mapping artik listede olmayabilir -
  // onMappingChange() ile ayni temizlik (dosya secimleri/onceki sonuc).
  onKurumFilterChange(): void {
    this.selectedMappingId = '';
    this.onMappingChange();
    this.loadMappings();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll, true);
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
  // orası bir denetim kaydı, burası anlık bir ozet. Ortak bicimleme mantigi
  // core/utils/relative-time.ts'te (Panel'deki hero karti da ayni fonksiyonu
  // kullaniyor).
  relativeTime(dateIso: string): string {
    return formatRelativeTime(dateIso);
  }

  // Native title tooltip'i yerine kendi baloncugumuz - uzun hata mesajlari
  // taninabilir/okunabilir olsun, satiri genisletmeden. position:fixed
  // kullaniliyor ki .recent-runs-section'daki overflow:hidden (kart
  // koselerini yuvarlamak icin) balonu kesmesin.
  showErrorTooltip(event: MouseEvent, message: string): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const tooltipWidth = 360;
    const margin = 6;

    // Satir ekranin alt kismina yakinsa balonu yukari ac ki ekran disina tasmasin.
    const showAbove = window.innerHeight - rect.bottom < 120;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - tooltipWidth - 16));

    this.errorTooltip.set({
      text: message,
      left,
      top: showAbove ? null : rect.bottom + margin,
      bottom: showAbove ? window.innerHeight - rect.top + margin : null,
    });
  }

  hideErrorTooltip(): void {
    this.errorTooltip.set(null);
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
