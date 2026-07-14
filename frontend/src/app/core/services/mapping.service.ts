import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateMappingRequest, Mapping } from '../models/mapping.model';

@Injectable({ providedIn: 'root' })
export class MappingService {
  private readonly http = inject(HttpClient);

  create(request: CreateMappingRequest): Observable<Mapping> {
    return this.http.post<Mapping>(`${environment.apiUrl}/mappings`, request);
  }
}
