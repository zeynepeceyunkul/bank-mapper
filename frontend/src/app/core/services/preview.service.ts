import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PreviewService {
  private readonly http = inject(HttpClient);

  execute(mappingId: string, file: File): Observable<Record<string, unknown>[]> {
    const formData = new FormData();
    formData.append('MappingId', mappingId);
    formData.append('File', file);

    return this.http.post<Record<string, unknown>[]>(`${environment.apiUrl}/preview/execute`, formData);
  }
}
