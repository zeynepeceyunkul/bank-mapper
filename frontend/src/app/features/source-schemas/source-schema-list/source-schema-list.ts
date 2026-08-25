import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SourceSchemaService } from '../../../core/services/source-schema.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthService } from '../../../core/services/auth.service';
import { FileFormat, SourceSchema } from '../../../core/models/source-schema.model';
import { SortOption } from '../../../core/models/paged-result.model';

interface ManualFieldRow {
  name: string;
  startIndex: number;
  length: number;
}

@Component({
  selector: 'app-source-schema-list',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './source-schema-list.html',
  styleUrl: './source-schema-list.scss',
})
export class SourceSchemaList implements OnInit {
  private readonly sourceSchemaService = inject(SourceSchemaService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly authService = inject(AuthService);

  @Output() readonly schemaCreated = new EventEmitter<SourceSchema>();
  @Output() readonly schemaDeleted = new EventEmitter<string>();

  readonly showList = signal(false);
  readonly schemaColumns = ['name', 'fileFormat', 'hasHeader', 'fieldCount', 'actions'];

  // Olusturma formu durumu
  name = '';
  fileFormat: FileFormat | '' = '';
  hasHeader = true;
  delimiter = ',';
  selectedFile: File | null = null;
  manualFields = signal<ManualFieldRow[]>([{ name: '', startIndex: 0, length: 0 }]);

  readonly saving = signal(false);
  readonly created = signal<SourceSchema | null>(null);

  // Liste durumu
  readonly schemas = signal<SourceSchema[]>([]);
  readonly listError = signal<string | null>(null);

  // Sadece ilk yukleme icin - mapping-list.ts'teki ayni desen (bkz. oradaki
  // yorum).
  readonly loading = signal(true);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly totalCount = signal(0);
  readonly pageSizeOptions = [5, 10, 25, 50];
  readonly sort = signal<SortOption>('RecentFirst');
  readonly search = signal('');
  private searchDebounceHandle?: ReturnType<typeof setTimeout>;

  get isFixedLength(): boolean {
    return this.fileFormat === 'FixedLength';
  }

  // mapping-list.ts'teki canManageMappings ile ayni gerekce/rol seti.
  canManageSchemas(): boolean {
    return this.authService.hasRole('SuperAdmin', 'MappingDefiner');
  }

  ngOnInit(): void {
    this.loadSchemas();
  }

  loadSchemas(): void {
    this.listError.set(null);
    this.sourceSchemaService.getPage(this.pageIndex(), this.pageSize(), this.sort(), this.search()).subscribe({
      next: (result) => {
        this.schemas.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.listError.set('Şema listesi yüklenemedi. API çalışıyor mu?');
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadSchemas();
  }

  onSortChange(value: SortOption): void {
    this.sort.set(value);
    this.pageIndex.set(0);
    this.loadSchemas();
  }

  // Her tus vuruşunda istek atmamak icin kisa bir debounce - kullanici
  // yazmayi biraktiktan 300ms sonra gerçek sorgu gidiyor.
  onSearchChange(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounceHandle);
    this.searchDebounceHandle = setTimeout(() => {
      this.pageIndex.set(0);
      this.loadSchemas();
    }, 300);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  addManualField(): void {
    this.manualFields.update((rows) => [...rows, { name: '', startIndex: 0, length: 0 }]);
  }

  removeManualField(index: number): void {
    this.manualFields.update((rows) => rows.filter((_, i) => i !== index));
  }

  toggleList(): void {
    this.showList.update((v) => !v);
  }

  submit(): void {
    this.created.set(null);

    if (!this.name.trim()) {
      this.toastService.error('Şema adı zorunlu.');
      return;
    }

    if (!this.fileFormat) {
      this.toastService.error('Dosya formatı zorunlu.');
      return;
    }

    const formData = new FormData();
    formData.append('Name', this.name.trim());
    formData.append('FileFormat', this.fileFormat);
    formData.append('HasHeader', String(this.isFixedLength ? false : this.hasHeader));

    if (this.isFixedLength) {
      const fields = this.manualFields()
        .filter((f) => f.name.trim())
        .map((f, index) => ({
          name: f.name.trim(),
          type: 'string',
          order: index + 1,
          startIndex: f.startIndex,
          length: f.length,
        }));

      if (fields.length === 0) {
        this.toastService.error('En az bir alan tanımlamalısınız.');
        return;
      }

      formData.append('FieldsJson', JSON.stringify(fields));
    } else {
      if (!this.selectedFile) {
        this.toastService.error('Excel/CSV için bir dosya seçmelisiniz.');
        return;
      }
      formData.append('Delimiter', this.delimiter);
      formData.append('File', this.selectedFile);
    }

    this.saving.set(true);

    this.sourceSchemaService.create(formData).subscribe({
      next: (schema) => {
        this.created.set(schema);
        this.saving.set(false);
        this.toastService.success(`Kaydedildi: ${schema.name}`);
        this.loadSchemas();
        this.schemaCreated.emit(schema);
      },
      error: () => {
        this.saving.set(false);
        this.toastService.error('Şema kaydedilemedi. API çalışıyor mu?');
      },
    });
  }

  async deleteSchema(schema: SourceSchema): Promise<void> {
    const confirmed = await this.confirmService.confirm(`'${schema.name}' şemasını silmek istediğinize emin misiniz?`);
    if (!confirmed) return;

    this.sourceSchemaService.delete(schema.id).subscribe({
      next: () => {
        // Yerel filtreleme yerine sayfayi yeniden yukluyoruz - server-side
        // pagination'da toplam sayi/sayfa mantigi backend'de, yerel filter()
        // bunları senkron tutamaz. Silinen kayit o sayfadaki tek kayitsa ve
        // ilk sayfada degilsek bir onceki sayfaya donuyoruz.
        if (this.schemas().length === 1 && this.pageIndex() > 0) {
          this.pageIndex.update((i) => i - 1);
        }
        this.loadSchemas();
        this.toastService.success(`Silindi: ${schema.name}`);
        this.schemaDeleted.emit(schema.id);
      },
      // Backend, sema bir mapping tarafindan kullaniliyorsa ArgumentException
      // (400 + duz metin govde) donduruyor - o mesaji dogrudan gosteriyoruz,
      // aksi halde genel bir hata mesaji.
      error: (err) => {
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Şema silinemedi. API çalışıyor mu?');
      },
    });
  }
}
