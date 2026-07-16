import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MappingService } from '../../../core/services/mapping.service';
import { PreviewService } from '../../../core/services/preview.service';
import { Mapping } from '../../../core/models/mapping.model';

@Component({
  selector: 'app-preview-execute',
  imports: [FormsModule],
  templateUrl: './preview-execute.html',
  styleUrl: './preview-execute.scss',
})
export class PreviewExecute implements OnInit {
  private readonly mappingService = inject(MappingService);
  private readonly previewService = inject(PreviewService);

  readonly mappings = signal<Mapping[]>([]);
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  selectedMappingId = '';
  selectedFile: File | null = null;

  ngOnInit(): void {
    this.mappingService.getAll().subscribe({
      next: (mappings) => this.mappings.set(mappings),
      error: () => this.error.set('Mapping listesi yüklenemedi. API çalışıyor mu?'),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  get columns(): string[] {
    const first = this.rows()[0];
    return first ? Object.keys(first) : [];
  }

  runPreview(): void {
    this.error.set(null);
    this.rows.set([]);

    if (!this.selectedMappingId) {
      this.error.set('Bir mapping seçmelisin.');
      return;
    }

    if (!this.selectedFile) {
      this.error.set('Bir dosya seçmelisin.');
      return;
    }

    this.loading.set(true);

    this.previewService.execute(this.selectedMappingId, this.selectedFile).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(typeof err.error === 'string' ? err.error : 'Önizleme başarısız. API çalışıyor mu?');
        this.loading.set(false);
      },
    });
  }
}
