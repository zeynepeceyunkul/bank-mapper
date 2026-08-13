import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateMappingRequest, Mapping } from '../models/mapping.model';
import { PagedResult, SortOption } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class MappingService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Mapping[]> {
    return this.http.get<Mapping[]>(`${environment.apiUrl}/mappings`);
  }

  // Sadece liste ekrani (mapping-list) icin - dropdown'lar (preview-execute,
  // mapping-editor'daki kaynak sema secimi) hala tam listeye ihtiyac duydugu
  // icin getAll() ayrica duruyor, bu ikisi birbirinin yerine gecmiyor.
  getPage(pageIndex: number, pageSize: number, sort: SortOption = 'RecentFirst'): Observable<PagedResult<Mapping>> {
    return this.http.get<PagedResult<Mapping>>(`${environment.apiUrl}/mappings/page`, {
      params: { pageIndex, pageSize, sort },
    });
  }

  getById(id: string): Observable<Mapping> {
    return this.http.get<Mapping>(`${environment.apiUrl}/mappings/${id}`);
  }

  create(request: CreateMappingRequest): Observable<Mapping> {
    return this.http.post<Mapping>(`${environment.apiUrl}/mappings`, request);
  }

  update(id: string, request: CreateMappingRequest): Observable<Mapping> {
    return this.http.put<Mapping>(`${environment.apiUrl}/mappings/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/mappings/${id}`);
  }
}
