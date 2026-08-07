import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FieldMatchSuggestion, SuggestFieldMatchesRequest } from '../models/field-match-suggestion.model';

@Injectable({ providedIn: 'root' })
export class FieldMatchSuggestionService {
  private readonly http = inject(HttpClient);

  suggest(sourceFieldNames: string[], targetFieldNames: string[]): Observable<FieldMatchSuggestion[]> {
    const request: SuggestFieldMatchesRequest = { sourceFieldNames, targetFieldNames };
    return this.http.post<FieldMatchSuggestion[]>(`${environment.apiUrl}/field-match-suggestions`, request);
  }
}
