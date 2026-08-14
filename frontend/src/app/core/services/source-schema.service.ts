import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SourceSchema } from '../models/source-schema.model';
import { PagedResult, SortOption } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class SourceSchemaService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<SourceSchema[]> {
    return this.http.get<SourceSchema[]>(`${environment.apiUrl}/source-schemas`);
  }

  // Sadece liste ekrani icin - mapping-editor'daki kaynak sema secimi hala tam
  // listeye ihtiyac duydugu icin getAll() ayrica duruyor.
  getPage(pageIndex: number, pageSize: number, sort: SortOption = 'NameAscending', search = ''): Observable<PagedResult<SourceSchema>> {
    const params: Record<string, string | number> = { pageIndex, pageSize, sort };
    if (search.trim()) {
      params['search'] = search.trim();
    }
    return this.http.get<PagedResult<SourceSchema>>(`${environment.apiUrl}/source-schemas/page`, { params });
  }

  create(formData: FormData): Observable<SourceSchema> {
    return this.http.post<SourceSchema>(`${environment.apiUrl}/source-schemas`, formData);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/source-schemas/${id}`);
  }
}
