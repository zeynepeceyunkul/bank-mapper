import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SourceSchema } from '../models/source-schema.model';

@Injectable({ providedIn: 'root' })
export class SourceSchemaService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<SourceSchema[]> {
    return this.http.get<SourceSchema[]>(`${environment.apiUrl}/source-schemas`);
  }

  create(formData: FormData): Observable<SourceSchema> {
    return this.http.post<SourceSchema>(`${environment.apiUrl}/source-schemas`, formData);
  }
}
