import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MappingRun, RunKind } from '../models/run-history.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class RunHistoryService {
  private readonly http = inject(HttpClient);

  getPage(
    pageIndex: number,
    pageSize: number,
    kind?: RunKind,
    success?: boolean,
  ): Observable<PagedResult<MappingRun>> {
    const params: Record<string, string | number | boolean> = { pageIndex, pageSize };
    if (kind) {
      params['kind'] = kind;
    }
    if (success !== undefined) {
      params['success'] = success;
    }
    return this.http.get<PagedResult<MappingRun>>(`${environment.apiUrl}/run-history/page`, { params });
  }
}
