export interface FunctoidParameterDefinition {
  key: string;
  label: string;
  type: 'string' | 'number';
}

export interface FunctoidPortDefinition {
  name: string;
  label: string;
}

export interface FunctoidDefinition {
  code: string;
  name: string;
  parameters: FunctoidParameterDefinition[];
  inputPorts: FunctoidPortDefinition[];
}
