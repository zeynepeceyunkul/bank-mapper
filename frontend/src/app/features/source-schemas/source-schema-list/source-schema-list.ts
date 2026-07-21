import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SourceSchemaService } from '../../../core/services/source-schema.service';
import { FileFormat, SourceSchema } from '../../../core/models/source-schema.model';

interface ManualFieldRow {
  name: string;
  startIndex: number;
  length: number;
}

@Component({
  selector: 'app-source-schema-list',
  imports: [FormsModule],
  templateUrl: './source-schema-list.html',
  styleUrl: './source-schema-list.scss',
})
export class SourceSchemaList implements OnInit {
  private readonly sourceSchemaService = inject(SourceSchemaService);

  @Output() readonly schemaCreated = new EventEmitter<SourceSchema>();

  readonly showList = signal(false);

  // Olusturma formu durumu
  name = '';
  fileFormat: FileFormat = 'Csv';
  hasHeader = true;
  delimiter = ',';
  selectedFile: File | null = null;
  manualFields = signal<ManualFieldRow[]>([{ name: '', startIndex: 0, length: 0 }]);

  readonly saving = signal(false);
  readonly createError = signal<string | null>(null);
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
    this.createError.set(null);
    this.created.set(null);

    if (!this.name.trim()) {
      this.createError.set('Şema adı zorunlu.');
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
        this.createError.set('En az bir alan tanımlamalısınız.');
        return;
      }

      formData.append('FieldsJson', JSON.stringify(fields));
    } else {
      if (!this.selectedFile) {
        this.createError.set('Excel/CSV için bir dosya seçmelisiniz.');
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
        this.loadSchemas();
        this.schemaCreated.emit(schema);
      },
      error: () => {
        this.createError.set('Şema kaydedilemedi. API çalışıyor mu?');
        this.saving.set(false);
      },
    });
  }
}
