export type UserRole = 'Viewer' | 'MappingDefiner' | 'Approver' | 'SuperAdmin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}
