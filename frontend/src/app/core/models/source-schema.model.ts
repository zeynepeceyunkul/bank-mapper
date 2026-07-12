export type FileFormat = 'Excel' | 'Csv' | 'FixedLength';

export interface SourceField {
  name: string;
  type: string;
  order: number;
  startIndex: number | null;
  length: number | null;
}

export interface SourceFormatOptions {
  hasHeader: boolean;
  delimiter: string | null;
}

export interface SourceSchema {
  id: string;
  name: string;
  fileFormat: FileFormat;
  fields: SourceField[];
  formatOptions: SourceFormatOptions;
}
