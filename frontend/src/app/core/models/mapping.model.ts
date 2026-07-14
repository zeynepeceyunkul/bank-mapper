export interface FunctoidStep {
  type: string;
  order: number;
  params?: Record<string, unknown> | null;
  appliesTo?: string[] | null;
}

export interface FieldMapping {
  targetField: string;
  sourceFields: string[];
  functoidChain: FunctoidStep[];
}

export interface Mapping {
  id: string;
  name: string;
  sourceSchemaId: string;
  fileTypeId: string;
  fieldMappings: FieldMapping[];
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateMappingRequest {
  name: string;
  sourceSchemaId: string;
  fileTypeId: string;
  fieldMappings: FieldMapping[];
}
