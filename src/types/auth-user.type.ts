export interface AuthUser {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  sessionId: string;
  permissions: string[];
  roles: string[];
}

export interface UserSubject {
  id: number;
}
