export interface TargetField {
  name: string;
  type: string;
  order: number;
  length: number | null;
  isRequired: boolean;
  validationFormat?: 'None' | 'Iban' | 'TcKimlikNo' | 'PositiveDecimal';
}

export interface FileType {
  id: string;
  productId: string;
  code: string;
  name: string;
  targetFields: TargetField[];
}
