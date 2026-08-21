import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateMappingRequest, Mapping, MappingStatus } from '../models/mapping.model';
import { PagedResult, SortOption } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class MappingService {
  private readonly http = inject(HttpClient);

  // app.ts'teki nav rozeti (pendingApprovalCount) eskiden sadece
  // NavigationEnd'de yenileniyordu - Onaylar ekranindan (approval-queue.ts)
  // sayfadan hic ayrilmadan onayla/reddet yapinca rozet guncel kalmiyordu,
  // ancak baska bir sekmeye/route'a gecince duzeliyordu (Ece'nin bulgusu).
  // approve/reject cagrisini yapan HERKES (approval-queue.ts, mapping-editor.ts)
  // ayrica hatirlayip bir seyi tetiklemek zorunda kalmasin diye bildirim
  // burada, cagrinin GERCEKTEN basarili oldugu an (tap, subscribe eden
  // herkesten bagimsiz) tek yerden yapiliyor.
  readonly approvalChanged$ = new Subject<void>();

  // Sadece liste ekrani (mapping-list) icin - dropdown'lar (preview-execute,
  // mapping-editor'daki kaynak sema secimi) hala tam listeye ihtiyac duydugu
  // icin getAll() ayrica duruyor, bu ikisi birbirinin yerine gecmiyor.
  // Onizleme dropdown'u status:'Approved' geciyor - henuz onaylanmamis bir
  // mapping'le donusturme calistirilamaz (backend de ayrica bunu zorluyor).
  getAll(status?: MappingStatus, kurumId?: string): Observable<Mapping[]> {
    const params: Record<string, string> = {};
    if (status) {
      params['status'] = status;
    }
    if (kurumId) {
      params['kurumId'] = kurumId;
    }
    return this.http.get<Mapping[]>(`${environment.apiUrl}/mappings`, { params });
  }

  getPage(
    pageIndex: number,
    pageSize: number,
    sort: SortOption = 'RecentFirst',
    search = '',
    status?: MappingStatus,
  ): Observable<PagedResult<Mapping>> {
    const params: Record<string, string | number> = { pageIndex, pageSize, sort };
    if (search.trim()) {
      params['search'] = search.trim();
    }
    if (status) {
      params['status'] = status;
    }
    return this.http.get<PagedResult<Mapping>>(`${environment.apiUrl}/mappings/page`, { params });
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

  approve(id: string): Observable<Mapping> {
    return this.http
      .post<Mapping>(`${environment.apiUrl}/mappings/${id}/approve`, {})
      .pipe(tap(() => this.approvalChanged$.next()));
  }

  reject(id: string, reason: string): Observable<Mapping> {
    return this.http
      .post<Mapping>(`${environment.apiUrl}/mappings/${id}/reject`, { reason })
      .pipe(tap(() => this.approvalChanged$.next()));
  }
}
