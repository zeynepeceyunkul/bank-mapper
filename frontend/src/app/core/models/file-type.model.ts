export interface TargetField {
  name: string;
  type: string;
  order: number;
  length: number | null;
}

export interface FileType {
  id: string;
  productId: string;
  code: string;
  name: string;
  targetFields: TargetField[];
}
