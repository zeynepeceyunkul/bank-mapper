import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FunctoidDefinition } from '../models/functoid.model';

@Injectable({ providedIn: 'root' })
export class FunctoidService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<FunctoidDefinition[]> {
    return this.http.get<FunctoidDefinition[]>(`${environment.apiUrl}/functoids`);
  }
}
