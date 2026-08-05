import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { SourceSchemaService } from '../../../core/services/source-schema.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { FileFormat, SourceSchema } from '../../../core/models/source-schema.model';

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
  ],
  templateUrl: './source-schema-list.html',
  styleUrl: './source-schema-list.scss',
})
export class SourceSchemaList implements OnInit {
  private readonly sourceSchemaService = inject(SourceSchemaService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

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

  get isFixedLength(): boolean {
    return this.fileFormat === 'FixedLength';
  }

  ngOnInit(): void {
    this.loadSchemas();
  }

  loadSchemas(): void {
    this.listError.set(null);
    this.sourceSchemaService.getAll().subscribe({
      next: (schemas) => this.schemas.set(schemas),
      error: () => this.listError.set('Şema listesi yüklenemedi. API çalışıyor mu?'),
    });
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
        this.schemas.update((list) => list.filter((s) => s.id !== schema.id));
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
