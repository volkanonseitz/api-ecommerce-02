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

export interface ShopSubject {
  id: number;
  ownerId: number;
  isStaff?: boolean;
}

export interface OwnershipTransferSubject {
  id: number;
  fromId: number;
  toId: number;
}
