/**
 * Representasi user yang sudah terautentikasi, dipasang di request.user
 * oleh JwtAccessStrategy. Sengaja dibuat ringkas (bukan seluruh row User)
 * supaya tidak menempelkan data sensitif (password hash, dsb) ke request.
 */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  sessionId: string;
  /** nama permission, mis. 'super_admin' | 'store_owner' | 'staff' | 'customer' */
  permissions: string[];
  /** nama role, mis. 'super_admin' | 'store_owner' | 'staff' | 'customer' */
  roles: string[];
}

/** Subset kolom User yang cukup untuk dievaluasi CASL (tanpa fetch penuh berulang kali). */
export interface UserSubject {
  id: number;
}
