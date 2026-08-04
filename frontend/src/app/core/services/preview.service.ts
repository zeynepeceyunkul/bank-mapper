import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PreviewSourceFileUpload {
  schemaId: string;
  file: File;
}

// Backend'de FixedLength de tanimli ama disa aktarma icin henuz desteklenmiyor
// (bazi hedef alanlarin Length'i tanimsiz - sabit genislik kurali belirsiz
// kaliyor) - o yuzden burada sadece indirilebilen iki format var.
export type ConvertFileFormat = 'Csv' | 'Excel';

export interface PreviewExecuteResult {
  rows: Record<string, unknown>[];
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class PreviewService {
  private readonly http = inject(HttpClient);

  execute(mappingId: string, files: PreviewSourceFileUpload[]): Observable<PreviewExecuteResult> {
    return this.http.post<PreviewExecuteResult>(`${environment.apiUrl}/preview/execute`, this.buildFormData(mappingId, files));
  }

  convert(mappingId: string, files: PreviewSourceFileUpload[], format: ConvertFileFormat): Observable<Blob> {
    const formData = this.buildFormData(mappingId, files);
    formData.append('Format', format);
    return this.http.post(`${environment.apiUrl}/preview/convert`, formData, {
      responseType: 'blob',
    });
  }

  private buildFormData(mappingId: string, files: PreviewSourceFileUpload[]): FormData {
    const formData = new FormData();
    formData.append('MappingId', mappingId);

    for (const { schemaId, file } of files) {
      formData.append('Files', file);
      formData.append('SourceSchemaIds', schemaId);
    }

    return formData;
  }
}
