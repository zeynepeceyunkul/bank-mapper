import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PreviewSourceFileUpload {
  schemaId: string;
  file: File;
}

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

  convert(mappingId: string, files: PreviewSourceFileUpload[]): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/preview/convert`, this.buildFormData(mappingId, files), {
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
