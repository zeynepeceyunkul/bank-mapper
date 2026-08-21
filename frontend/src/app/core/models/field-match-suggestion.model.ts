export interface FieldMatchSuggestion {
  sourceFields: string[];
  targetField: string;
  functoidCode: string | null;
  padChar?: string | null;
  length?: number | null;
}

export interface SuggestTargetField {
  name: string;
  length: number | null;
}

export interface SuggestFieldMatchesRequest {
  sourceFieldNames: string[];
  targetFields: SuggestTargetField[];
}
