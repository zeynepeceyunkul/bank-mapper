import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateInstitutionRequest, Institution } from '../models/institution.model';
import { PagedResult, SortOption } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class InstitutionService {
  private readonly http = inject(HttpClient);

  // Sadece liste ekrani icin - mapping-editor'daki Kurum etiketleme (Aşama B)
  // tam listeye ihtiyac duyacagi icin getAll() ayrica duruyor.
  getAll(): Observable<Institution[]> {
    return this.http.get<Institution[]>(`${environment.apiUrl}/institutions`);
  }

  getPage(pageIndex: number, pageSize: number, sort: SortOption = 'NameAscending', search = ''): Observable<PagedResult<Institution>> {
    const params: Record<string, string | number> = { pageIndex, pageSize, sort };
    if (search.trim()) {
      params['search'] = search.trim();
    }
    return this.http.get<PagedResult<Institution>>(`${environment.apiUrl}/institutions/page`, { params });
  }

  create(request: CreateInstitutionRequest): Observable<Institution> {
    return this.http.post<Institution>(`${environment.apiUrl}/institutions`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/institutions/${id}`);
  }
}
