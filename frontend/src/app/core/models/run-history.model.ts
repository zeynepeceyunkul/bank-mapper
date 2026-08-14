export type RunKind = 'Preview' | 'Convert';

export interface MappingRun {
  id: string;
  mappingId: string;
  mappingName: string;
  kind: RunKind;
  fileNames: string[];
  success: boolean;
  rowCount: number | null;
  errorMessage: string | null;
  runAt: string;
}
