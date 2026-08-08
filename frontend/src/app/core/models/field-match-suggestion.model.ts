export interface FieldMatchSuggestion {
  sourceFields: string[];
  targetField: string;
  functoidCode: string | null;
}

export interface SuggestFieldMatchesRequest {
  sourceFieldNames: string[];
  targetFieldNames: string[];
}
