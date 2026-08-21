export type UserRole = 'Viewer' | 'MappingDefiner' | 'Approver' | 'Admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}
