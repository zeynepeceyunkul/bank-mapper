export interface Institution {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateInstitutionRequest {
  name: string;
}
