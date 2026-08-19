export type EdgeEndpointKind = 'SourceField' | 'NodeOutput' | 'ConstantOutput' | 'NodeInput' | 'TargetField';

export interface FunctoidNode {
  id: string;
  functoidCode: string;
  params?: Record<string, unknown> | null;
  positionX: number;
  positionY: number;
}

export interface ConstantNode {
  id: string;
  value: string;
  positionX: number;
  positionY: number;
}

export interface GraphEdge {
  id: string;
  fromKind: EdgeEndpointKind;
  fromSourceSchemaId?: string | null;
  fromFieldName?: string | null;
  fromNodeId?: string | null;
  toKind: EdgeEndpointKind;
  toNodeId?: string | null;
  toPort?: string | null;
  toFieldName?: string | null;
}

export interface MappingSourceSchemaRef {
  sourceSchemaId: string;
  alias: string;
  positionX: number;
  positionY: number;
}

export type MappingStatus = 'PendingApproval' | 'Approved' | 'Rejected';

export interface Mapping {
  id: string;
  name: string;
  sourceSchemas: MappingSourceSchemaRef[];
  fileTypeId: string;
  functoidNodes: FunctoidNode[];
  constantNodes: ConstantNode[];
  edges: GraphEdge[];
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  status: MappingStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
}

export interface CreateMappingRequest {
  name: string;
  sourceSchemas: MappingSourceSchemaRef[];
  fileTypeId: string;
  functoidNodes: FunctoidNode[];
  constantNodes: ConstantNode[];
  edges: GraphEdge[];
}
