export interface FunctoidParameterDefinition {
  key: string;
  label: string;
  type: 'string' | 'number';
}

export interface FunctoidDefinition {
  code: string;
  name: string;
  parameters: FunctoidParameterDefinition[];
}
