import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserRole } from '../models/user.model';
import { PagedResult, SortOption } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  // institution.service.ts'teki getPage ile ayni desen.
  getPage(pageIndex: number, pageSize: number, sort: SortOption = 'NameAscending', search = '', role?: UserRole): Observable<PagedResult<User>> {
    const params: Record<string, string | number> = { pageIndex, pageSize, sort };
    if (search.trim()) {
      params['search'] = search.trim();
    }
    if (role) {
      params['role'] = role;
    }
    return this.http.get<PagedResult<User>>(`${environment.apiUrl}/users/page`, { params });
  }

  updateRole(id: string, role: UserRole): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}/role`, { role });
  }
}
